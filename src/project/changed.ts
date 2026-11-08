import { execFileSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { toPosix } from "./walk.js";

/** A user-supplied `--files` path that could not be resolved to a project file. */
export interface DroppedPath {
  /** The path as the user typed it. */
  path: string;
  reason: "does not exist" | "outside the project root";
}

/** A user-supplied `--files` path resolved to a root-relative POSIX path. */
export interface KeptPath {
  /** Root-relative POSIX path, with the on-disk casing. */
  rel: string;
  /** The path as the user typed it. */
  path: string;
}

/**
 * Normalise user-supplied `--files` paths (absolute, relative to the current
 * directory, or relative to the project root) to root-relative POSIX paths.
 * Paths that do not exist, or that fall outside the root, are reported in
 * `dropped` with the reason instead of silently vanishing. On case-insensitive
 * filesystems the kept paths carry the on-disk casing so they match the walk.
 */
export function resolveProjectPaths(root: string, paths: string[]): { kept: KeptPath[]; dropped: DroppedPath[] } {
  const realRoot = toReal(root) ?? root;
  const kept: KeptPath[] = [];
  const dropped: DroppedPath[] = [];
  for (const p of paths) {
    // Compare real paths only: the root is a real path, and a typed path may
    // differ from it by symlinks, casing, or Windows 8.3 short names (RUNNER~1).
    const candidates = [resolve(p), resolve(root, p)]
      .filter((abs) => existsSync(abs))
      .map((abs) => toReal(abs) ?? abs);
    const real = candidates.find((c) => isInside(realRoot, c));
    if (!real) {
      dropped.push({ path: p, reason: candidates.length > 0 ? "outside the project root" : "does not exist" });
      continue;
    }
    const rel = toPosix(relative(realRoot, real));
    if (!kept.some((k) => k.rel === rel)) kept.push({ rel, path: p });
  }
  return { kept, dropped };
}

function isInside(root: string, abs: string): boolean {
  const rel = toPosix(relative(root, abs));
  return !!rel && rel !== ".." && !rel.startsWith("../") && !isAbsolute(rel);
}

function toReal(path: string): string | undefined {
  // The native realpath is the only one that returns the on-disk casing on
  // case-insensitive filesystems; the JS fallback still resolves symlinks.
  try {
    return realpathSync.native(path);
  } catch {
    try {
      return realpathSync(path);
    } catch {
      return undefined;
    }
  }
}

/**
 * Root-relative POSIX paths of files changed since `ref` in the git work tree
 * containing `root`: committed and uncommitted changes plus untracked files.
 * Only paths under `root` are returned.
 */
export function changedSince(root: string, ref: string): string[] {
  if (ref.startsWith("-")) throw new Error(`Invalid git ref: ${ref}`);
  const git = (...args: string[]): string[] => {
    try {
      return execFileSync("git", ["-C", root, ...args], { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] })
        .split("\0")
        .filter(Boolean);
    } catch (err) {
      const stderr = (err as { stderr?: Buffer | string }).stderr?.toString().trim();
      throw new Error(`git ${args[0]} failed${stderr ? `: ${stderr}` : ""}`, { cause: err });
    }
  };
  // --relative: paths relative to (and limited to) root when it is a subdirectory.
  const changed = git("diff", "-z", "--name-only", "--relative", "--diff-filter=d", ref, "--");
  const untracked = git("ls-files", "-z", "--others", "--exclude-standard");
  // git always prints forward-slash paths.
  return [...new Set([...changed, ...untracked])];
}
