#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { lintProject, type ProjectLintResult } from "./lint/project.js";

type Format = "json" | "pretty";

interface ParsedArgs {
  command: string | undefined;
  projectPath: string | undefined;
  format: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  let format = "json";
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--format" || a === "-f") {
      format = argv[++i] ?? "";
    } else if (a.startsWith("--format=")) {
      format = a.slice("--format=".length);
    } else {
      positional.push(a);
    }
  }
  return { command: positional[0], projectPath: positional[1], format };
}

/** Exit code contract: 0 clean, 1 on any error-severity finding. */
export function exitCodeFor(res: ProjectLintResult): number {
  return res.errorCount > 0 ? 1 : 0;
}

export function renderJson(res: ProjectLintResult): string {
  return JSON.stringify(
    {
      root: res.root,
      fileCount: res.fileCount,
      errorCount: res.errorCount,
      warningCount: res.warningCount,
      infoCount: res.infoCount,
      findings: res.findings,
    },
    null,
    2,
  );
}

export function renderPretty(res: ProjectLintResult): string {
  const lines: string[] = [];
  let lastFile = "";
  for (const f of res.findings) {
    if (f.file !== lastFile) {
      lines.push(`\n${f.file}`);
      lastFile = f.file;
    }
    lines.push(`  ${f.line}:${f.col}  ${f.severity.toUpperCase().padEnd(7)} ${f.ruleId}`);
    lines.push(`         ${f.message}`);
    lines.push(`         fix: ${f.suggestion}`);
  }
  lines.push(
    `\n${res.fileCount} file(s): ${res.errorCount} error(s), ` +
      `${res.warningCount} warning(s), ${res.infoCount} info.`,
  );
  return lines.join("\n").trimStart();
}

/**
 * Run the CLI. Returns the process exit code (0 clean, 1 error findings,
 * 2 tool failure). Writers are injectable for testing.
 */
export async function runCli(
  argv: string[],
  log: (s: string) => void = console.log,
  errOut: (s: string) => void = console.error,
): Promise<number> {
  const { command, projectPath, format } = parseArgs(argv);
  if (command !== "lint" || !projectPath) {
    errOut("Usage: gdcorrect lint <projectPath> [--format json|pretty]");
    return 2;
  }
  if (format !== "json" && format !== "pretty") {
    errOut(`Unknown format: ${format}. Use 'json' or 'pretty'.`);
    return 2;
  }
  try {
    const res = await lintProject(projectPath);
    log(format === "pretty" ? renderPretty(res) : renderJson(res));
    return exitCodeFor(res);
  } catch (err) {
    errOut(`gdcorrect: ${err instanceof Error ? err.message : String(err)}`);
    return 2;
  }
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  runCli(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch(() => process.exit(2));
}
