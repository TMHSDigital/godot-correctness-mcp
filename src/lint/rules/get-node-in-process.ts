import { calleeName, fieldText, findAll, walk } from "../../gdscript/ast.js";
import type { Rule } from "../types.js";

const PROCESS_FNS = new Set(["_process", "_physics_process"]);
const NODE_GETTERS = new Set(["get_node", "get_node_or_null"]);

/** Flags $ / get_node() lookups inside _process / _physics_process. */
export const getNodeInProcess: Rule = {
  id: "get-node-in-process",
  description: "Node lookups ($ or get_node()) inside _process/_physics_process run every frame.",
  defaultSeverity: "warning",
  check(ctx) {
    const out = [];
    for (const fn of findAll(ctx.root, "function_definition")) {
      const name = fieldText(fn, "name", ctx.source);
      if (!name || !PROCESS_FNS.has(name)) continue;
      for (const n of walk(fn)) {
        const isDollar = n.type === "get_node";
        const isGetterCall =
          (n.type === "call" || n.type === "attribute_call") &&
          NODE_GETTERS.has(calleeName(n, ctx.source) ?? "");
        if (isDollar || isGetterCall) {
          out.push({
            node: n,
            message: `Node lookup inside ${name}() runs every frame.`,
            suggestion: "Cache the node once in an @onready var and reference that instead.",
          });
        }
      }
    }
    return out;
  },
};
