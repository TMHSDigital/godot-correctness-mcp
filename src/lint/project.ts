import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import picomatch from "picomatch";
import { loadConfig, type ResolvedConfig } from "./config.js";
import { lintSource } from "./engine.js";
import type { Finding } from "./types.js";

function toPosix(p: string): string {
  return p.split(sep).join("/");
}

function collectFiles(root: string): string[] {
  const out: string[] = [];
  const walkDir = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name === ".git") continue;
        walkDir(join(dir, entry.name));
      } else if (entry.isFile()) {
        out.push(join(dir, entry.name));
      }
    }
  };
  walkDir(root);
  return out;
}

export interface ProjectLintResult {
  root: string;
  fileCount: number;
  findings: Finding[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
}

/** Walk a project root, lint every included .gd file, and aggregate findings. */
export async function lintProject(
  root: string,
  config?: ResolvedConfig,
): Promise<ProjectLintResult> {
  const cfg = config ?? loadConfig(root);
  const isIncluded = picomatch(cfg.include, { dot: true });
  const isExcluded = picomatch(cfg.exclude, { dot: true });

  const files = collectFiles(root)
    .map((full) => ({ full, rel: toPosix(relative(root, full)) }))
    .filter(({ rel }) => isIncluded(rel) && !isExcluded(rel));

  const findings: Finding[] = [];
  for (const { full, rel } of files) {
    const source = readFileSync(full, "utf-8");
    findings.push(...(await lintSource(rel, source, cfg)));
  }

  findings.sort(
    (a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.col - b.col,
  );

  return {
    root,
    fileCount: files.length,
    findings,
    errorCount: findings.filter((f) => f.severity === "error").length,
    warningCount: findings.filter((f) => f.severity === "warning").length,
    infoCount: findings.filter((f) => f.severity === "info").length,
  };
}
