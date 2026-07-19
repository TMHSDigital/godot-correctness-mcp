import { findAll } from "../../gdscript/ast.js";
import type { Rule } from "../types.js";

/**
 * Flags var declarations with neither a type hint nor `:=` inference. Both
 * `var x: int = 1` (explicit) and `var x := 1` (inferred, grammar field
 * `type: inferred_type`) carry a `type` field; a bare `var x = 1` does not.
 */
export const untypedDeclaration: Rule = {
  id: "untyped-declaration",
  description: "Variable declared without a type hint or ':=' inference.",
  defaultSeverity: "warning",
  check(ctx) {
    const out = [];
    for (const vs of findAll(ctx.root, "variable_statement")) {
      if (vs.childForFieldName("type")) continue; // typed or `:=` inferred
      out.push({
        node: vs,
        message: "Variable declared without a type hint or ':=' inference.",
        suggestion: "Use ':=' to infer from the initializer, or annotate an explicit ': <Type>'.",
      });
    }
    return out;
  },
};
