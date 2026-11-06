import type { Node } from "web-tree-sitter";
import { parseGDScript } from "../gdscript/parser.js";
import {
  isRuleEnabled,
  ruleOptions,
  severityOverride,
  type ResolvedConfig,
} from "./config.js";
import { SCENE_RULE_IDS } from "./catalog.js";
import { DEFAULT_RULES } from "./rules/index.js";
import { applySuppressions, UNUSED_SUPPRESSION_RULE } from "./suppressions.js";
import type { Finding, Fix, RawFix } from "./types.js";

/**
 * Lint one GDScript source string. `file` is used only for the reported path.
 * Severity precedence: config override > per-finding severity > rule default.
 */
export async function lintSource(
  file: string,
  source: string,
  config: ResolvedConfig,
): Promise<Finding[]> {
  const tree = await parseGDScript(source);
  let findings: Finding[];
  try {
    findings = runRules(file, tree.rootNode, source, config);
  } finally {
    // Trees live on the WASM heap and are not garbage collected; free them
    // explicitly or a long-lived server grows without bound.
    tree.delete();
  }
  findings = applySuppressions(
    file,
    source,
    findings,
    isRuleEnabled(config, UNUSED_SUPPRESSION_RULE),
    // Scene/project checks (e.g. scene-node-path-missing) apply their own
    // directives, and a disabled rule has nothing to suppress.
    (id) => SCENE_RULE_IDS.has(id) || !isRuleEnabled(config, id),
  ).map((f) =>
    f.ruleId === UNUSED_SUPPRESSION_RULE
      ? { ...f, severity: severityOverride(config, f.ruleId) ?? f.severity }
      : f,
  );
  findings.sort((a, b) => a.line - b.line || a.col - b.col || a.ruleId.localeCompare(b.ruleId));
  return findings;
}

/** Offsets of the first character of every line. */
function lineStartOffsets(source: string): number[] {
  const starts = [0];
  for (let i = 0; i < source.length; i++) if (source[i] === "\n") starts.push(i + 1);
  return starts;
}

/** 1-based line/col for a string offset (columns count UTF-16 code units, like the editor). */
function positionOf(offset: number, lineStarts: number[]): { line: number; col: number } {
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineStarts[mid]! <= offset) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo + 1, col: offset - lineStarts[lo]! + 1 };
}

function resolveFix(fix: RawFix, lineStarts: number[]): Fix {
  return {
    description: fix.description,
    edits: fix.edits.map((e) => {
      const s = positionOf(e.start, lineStarts);
      const t = positionOf(e.end, lineStarts);
      return { startLine: s.line, startCol: s.col, endLine: t.line, endCol: t.col, replacement: e.replacement };
    }),
  };
}

function runRules(file: string, root: Node, source: string, config: ResolvedConfig): Finding[] {
  const findings: Finding[] = [];
  const lineStarts = lineStartOffsets(source);
  for (const rule of DEFAULT_RULES) {
    if (!isRuleEnabled(config, rule.id)) continue;
    const raws = rule.check({
      root,
      source,
      options: ruleOptions(config, rule.id),
      projectGodotVersion: config.projectGodotVersion,
    });
    for (const raw of raws) {
      const severity = severityOverride(config, rule.id) ?? raw.severity ?? rule.defaultSeverity;
      const pos = raw.node.startPosition;
      const finding: Finding = {
        file,
        line: pos.row + 1,
        col: pos.column + 1,
        ruleId: rule.id,
        severity,
        message: raw.message,
        suggestion: raw.suggestion,
      };
      if (raw.fix) finding.fix = resolveFix(raw.fix, lineStarts);
      findings.push(finding);
    }
  }
  return findings;
}
