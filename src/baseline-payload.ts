import { isAbsolute, join } from "node:path";
import { applyBaseline, readBaseline } from "./baseline.js";
import { severityCounts, type ProjectLintResult } from "./lint/project.js";
import type { Finding } from "./lint/types.js";
import type { ProjectReport } from "./scenes/report.js";
import type { RegistryResult } from "./scenes/validate.js";

/**
 * The payload shape of each command / tool. The CLI and the MCP tools both
 * build payloads through this module so their JSON is identical, with and
 * without a baseline.
 */
export type CommandPayload =
  | { kind: "lint"; payload: ProjectLintResult }
  | { kind: "findings"; payload: { root: string; findings: Finding[]; count: number } }
  | { kind: "registries"; payload: { root: string; count: number } & RegistryResult }
  | { kind: "report"; payload: ProjectReport };

export function findingsPayload(root: string, findings: Finding[]): CommandPayload {
  return { kind: "findings", payload: { root, findings, count: findings.length } };
}

export function registriesPayload(root: string, r: RegistryResult): CommandPayload {
  return { kind: "registries", payload: { root, ...r, count: r.findings.length } };
}

/**
 * Apply an already-read baseline to a payload: keep the command's own shape,
 * drop baselined findings from every findings list, recompute the counts, and
 * add `baselined` and `staleBaselineEntries`. `scope` limits stale counting to
 * the files a narrowed run checked.
 */
export function applyBaselineToPayload(
  root: string,
  p: CommandPayload,
  findings: Finding[],
  baseline: Parameters<typeof applyBaseline>[2],
  scope?: Iterable<string>,
): { findings: Finding[]; payload: Record<string, unknown>; baselined: number; stale: number } {
  const r = applyBaseline(root, findings, baseline, scope);
  const keep = new Set(r.newFindings);
  const pick = (fs: Finding[]): Finding[] => fs.filter((f) => keep.has(f));
  const extra = { baselined: r.baselined, staleBaselineEntries: r.stale };
  const kept = r.newFindings;
  let payload: Record<string, unknown>;
  switch (p.kind) {
    case "lint":
      payload = { ...p.payload, findings: pick(p.payload.findings), ...severityCounts(kept), ...extra };
      break;
    case "findings":
    case "registries":
      payload = { ...p.payload, findings: pick(p.payload.findings), count: kept.length, ...extra };
      break;
    case "report":
      payload = {
        ...p.payload,
        scenes: pick(p.payload.scenes),
        project: pick(p.payload.project),
        registries: pick(p.payload.registries),
        lint: pick(p.payload.lint),
        ...severityCounts(kept),
        totalFindings: kept.length,
        ...extra,
      };
      break;
  }
  return { findings: kept, payload, baselined: r.baselined, stale: r.stale };
}

/**
 * MCP tools: apply an optional baseline file to a payload. A relative
 * `baselinePath` resolves against the project root (the CLI resolves
 * `--baseline` against the current directory, like any CLI path).
 */
export function payloadWithBaseline(
  root: string,
  p: CommandPayload,
  findings: Finding[],
  baselinePath?: string,
): Record<string, unknown> {
  if (!baselinePath) return p.payload as unknown as Record<string, unknown>;
  const path = isAbsolute(baselinePath) ? baselinePath : join(root, baselinePath);
  return applyBaselineToPayload(root, p, findings, readBaseline(path)).payload;
}
