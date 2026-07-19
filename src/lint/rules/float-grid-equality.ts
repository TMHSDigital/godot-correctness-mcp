import type { Node } from "web-tree-sitter";
import { calleeName, findAll, operatorOf } from "../../gdscript/ast.js";
import type { Rule } from "../types.js";

const VEC_CTORS = new Set(["Vector2", "Vector3", "Vector4"]);

function isFloatOrVector(node: Node | null, source: string): boolean {
  if (!node) return false;
  if (node.type === "float") return true;
  if (node.type === "call" && VEC_CTORS.has(calleeName(node, source) ?? "")) return true;
  return false;
}

/**
 * Flags `==` / `!=` where one operand is a float literal or Vector constructor.
 * Info-only and false-positive prone by nature; easy to disable per project.
 */
export const floatGridEquality: Rule = {
  id: "float-grid-equality",
  description: "Direct == / != on float or Vector values (floating-point precision).",
  defaultSeverity: "info",
  check(ctx) {
    const out = [];
    for (const b of findAll(ctx.root, "binary_operator")) {
      const op = operatorOf(b, ctx.source);
      if (op !== "==" && op !== "!=") continue;
      const l = b.childForFieldName("left");
      const r = b.childForFieldName("right");
      if (isFloatOrVector(l, ctx.source) || isFloatOrVector(r, ctx.source)) {
        out.push({
          node: b,
          message: "Direct equality on float/Vector values is unreliable due to floating-point precision.",
          suggestion: "Use is_equal_approx() / is_zero_approx() (or Vector2.is_equal_approx()).",
        });
      }
    }
    return out;
  },
};
