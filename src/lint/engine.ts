import { parseGDScript } from "../gdscript/parser.js";
import {
  isRuleEnabled,
  ruleOptions,
  severityOverride,
  type ResolvedConfig,
} from "./config.js";
import { DEFAULT_RULES } from "./rules/index.js";
import type { Finding } from "./types.js";

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
  const root = tree.rootNode;
  const findings: Finding[] = [];

  for (const rule of DEFAULT_RULES) {
    if (!isRuleEnabled(config, rule.id)) continue;
    const raws = rule.check({ root, source, options: ruleOptions(config, rule.id) });
    for (const raw of raws) {
      const severity = severityOverride(config, rule.id) ?? raw.severity ?? rule.defaultSeverity;
      const pos = raw.node.startPosition;
      findings.push({
        file,
        line: pos.row + 1,
        col: pos.column + 1,
        ruleId: rule.id,
        severity,
        message: raw.message,
        suggestion: raw.suggestion,
      });
    }
  }

  findings.sort((a, b) => a.line - b.line || a.col - b.col || a.ruleId.localeCompare(b.ruleId));
  return findings;
}
