import { calleeName, text, walk } from "../../gdscript/ast.js";
import type { RawFinding, Rule } from "../types.js";

/** Plain relative child paths that `$` shorthand expresses unquoted: A, A/B_2. */
const SIMPLE_PATH = /^[A-Za-z_][A-Za-z0-9_]*(?:\/[A-Za-z_][A-Za-z0-9_]*)*$/;

const PATH_FNS = new Set([
  "get_node",
  "get_node_or_null",
  "has_node",
  "find_child",
  "get_node_and_resource",
  "NodePath",
]);

/** Flags string-literal node paths (rename-fragile). */
export const stringlyNodepath: Rule = {
  id: "stringly-nodepath",
  description: "String-literal node path passed to a node lookup or NodePath().",
  defaultSeverity: "info",
  check(ctx) {
    const out: RawFinding[] = [];
    for (const n of walk(ctx.root)) {
      if (n.type !== "call" && n.type !== "attribute_call") continue;
      const callee = calleeName(n, ctx.source);
      if (!callee || !PATH_FNS.has(callee)) continue;
      const first = n.childForFieldName("arguments")?.namedChild(0);
      if (first && first.type === "string") {
        const finding: RawFinding = {
          node: first,
          message: "String node path is rename-fragile; a renamed node breaks it silently at runtime.",
          suggestion: "Prefer the $NodePath shorthand or an @export var of type NodePath.",
        };
        // A bare get_node("A/B") with a plain path is exactly $A/B.
        const args = n.childForFieldName("arguments");
        const path = text(first, ctx.source).slice(1, -1);
        if (n.type === "call" && callee === "get_node" && args?.namedChildCount === 1 && SIMPLE_PATH.test(path)) {
          finding.fix = {
            description: `Use $${path}`,
            edits: [{ start: n.startIndex, end: n.endIndex, replacement: `$${path}` }],
          };
        }
        out.push(finding);
      }
    }
    return out;
  },
};
