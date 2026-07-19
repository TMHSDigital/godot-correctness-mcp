import { findAll } from "../../gdscript/ast.js";
import type { Rule } from "../types.js";

// Awaiting any of these is always wrong; awaiting an identifier/call is left
// alone because it may resolve to a Signal or coroutine (unknowable statically).
const LITERALS = new Set([
  "integer",
  "float",
  "string",
  "string_name",
  "true",
  "false",
  "array",
  "dictionary",
]);

/** Flags `await` applied to a literal value. Conservative: literals only. */
export const awaitMisuse: Rule = {
  id: "await-misuse",
  description: "await applied to a literal value (expects a signal or coroutine).",
  defaultSeverity: "warning",
  check(ctx) {
    const out = [];
    for (const aw of findAll(ctx.root, "await_expression")) {
      const operand = aw.namedChild(0);
      if (operand && LITERALS.has(operand.type)) {
        out.push({
          node: aw,
          message: "await on a literal value; await expects a signal or a coroutine.",
          suggestion: "Await a signal (e.g. `await timer.timeout`) or a coroutine call.",
        });
      }
    }
    return out;
  },
};
