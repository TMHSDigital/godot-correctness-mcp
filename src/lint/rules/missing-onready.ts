import type { Node } from "web-tree-sitter";
import { calleeName, text, walk } from "../../gdscript/ast.js";
import { findAll } from "../../gdscript/ast.js";
import type { Rule } from "../types.js";

const NODE_GETTERS = new Set(["get_node", "get_node_or_null"]);

function isNodeLookup(value: Node | null, source: string): boolean {
  if (!value) return false;
  if (value.type === "get_node") return true;
  if (value.type === "call" && NODE_GETTERS.has(calleeName(value, source) ?? "")) return true;
  return false;
}

function hasOnready(vs: Node, source: string): boolean {
  for (const c of vs.namedChildren) {
    if (c?.type !== "annotations") continue;
    for (const a of walk(c)) {
      if (a.type === "annotation") {
        const id = a.namedChild(0);
        if (id && text(id, source) === "onready") return true;
      }
    }
  }
  return false;
}

/** Flags class-level node-path members initialized without @onready. */
export const missingOnready: Rule = {
  id: "missing-onready",
  description: "Class-level node-path member initialized without @onready.",
  defaultSeverity: "warning",
  check(ctx) {
    const out = [];
    for (const vs of findAll(ctx.root, "variable_statement")) {
      // Class body only: a member var is a direct child of the source node.
      if (vs.parent?.type !== "source") continue;
      const value = vs.childForFieldName("value");
      if (!isNodeLookup(value, ctx.source)) continue;
      if (hasOnready(vs, ctx.source)) continue;
      out.push({
        node: vs,
        message: "Node-path member initialized without @onready; the child may not exist when the initializer runs.",
        suggestion: "Prefix the declaration with @onready so it resolves after the node enters the tree.",
      });
    }
    return out;
  },
};
