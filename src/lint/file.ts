import { readFileSync } from "node:fs";
import { dirname, relative, sep } from "node:path";
import { findProjectRoot, loadConfig } from "./config.js";
import { lintSource } from "./engine.js";
import type { Finding } from "./types.js";

function toPosix(p: string): string {
  return p.split(sep).join("/");
}

export interface FileLintResult {
  file: string;
  root: string;
  findings: Finding[];
  count: number;
}

/**
 * Lint a single file, resolving the config from the nearest project root at or
 * above the file's directory (see `findProjectRoot`). Findings are reported
 * relative to that root, matching `lintProject` for the same file.
 */
export async function lintFile(path: string, source?: string): Promise<FileLintResult> {
  const root = findProjectRoot(dirname(path));
  const code = source ?? readFileSync(path, "utf-8");
  const rel = toPosix(relative(root, path));
  const findings = await lintSource(rel, code, loadConfig(root));
  return { file: path, root, findings, count: findings.length };
}
