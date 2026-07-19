import { calleeName, fieldText, findAll, text, walk } from "../../gdscript/ast.js";
import type { Rule } from "../types.js";

/**
 * Flags connect() in _ready() with no CONNECT_ONE_SHOT flag and no disconnect()
 * anywhere in the file. Conservative: if the file disconnects at all, or uses a
 * one-shot flag, it stays silent to avoid false positives.
 */
export const connectWithoutDisconnect: Rule = {
  id: "connect-without-disconnect",
  description: "Signal connected in _ready() with no matching disconnect or one-shot flag.",
  defaultSeverity: "info",
  check(ctx) {
    const hasDisconnect = [...walk(ctx.root)].some(
      (n) =>
        (n.type === "call" || n.type === "attribute_call") &&
        calleeName(n, ctx.source) === "disconnect",
    );
    if (hasDisconnect) return [];

    const out = [];
    for (const fn of findAll(ctx.root, "function_definition")) {
      if (fieldText(fn, "name", ctx.source) !== "_ready") continue;
      for (const n of walk(fn)) {
        if (n.type !== "call" && n.type !== "attribute_call") continue;
        if (calleeName(n, ctx.source) !== "connect") continue;
        const args = n.childForFieldName("arguments");
        if (args && text(args, ctx.source).includes("CONNECT_ONE_SHOT")) continue;
        out.push({
          node: n,
          message: "Signal connected in _ready() with no disconnect() or CONNECT_ONE_SHOT; risks double-connect or a dangling reference.",
          suggestion: "Disconnect in _exit_tree(), pass CONNECT_ONE_SHOT, or guard with is_connected().",
        });
      }
    }
    return out;
  },
};
