import { join, relative } from "node:path";
import type { Finding, Severity } from "./lint/types.js";
import { compareFindings } from "./lint/project.js";
import { toPosix } from "./project/walk.js";

const COMMAND: Record<Severity, "error" | "warning" | "notice"> = {
  error: "error",
  warning: "warning",
  info: "notice",
};

/** Escape a workflow-command message (the text after `::`). */
export function escapeData(s: string): string {
  return s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}

/** Escape a workflow-command property value (`file=`, `title=`, ...). */
export function escapeProperty(s: string): string {
  return escapeData(s).replace(/:/g, "%3A").replace(/,/g, "%2C");
}

/**
 * Render findings as GitHub Actions workflow commands, one per line, so they
 * show inline on pull requests without SARIF upload. Paths are re-based onto
 * `cwd` (the repository root in a workflow), like SARIF output.
 */
export function toGithubAnnotations(findings: Finding[], opts: { projectRoot: string; cwd?: string }): string {
  const cwd = opts.cwd ?? process.cwd();
  return [...findings]
    .sort(compareFindings)
    .map((f) => {
      const file = toPosix(relative(cwd, join(opts.projectRoot, f.file)));
      const props = [`file=${file}`, `line=${f.line}`, `col=${f.col}`, `title=${f.ruleId}`].map((p) => {
        const eq = p.indexOf("=");
        return `${p.slice(0, eq)}=${escapeProperty(p.slice(eq + 1))}`;
      });
      const message = f.suggestion ? `${f.message} ${f.suggestion}` : f.message;
      return `::${COMMAND[f.severity]} ${props.join(",")}::${escapeData(message)}`;
    })
    .join("\n");
}
