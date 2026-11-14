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

function isOnready(a: Node, source: string): boolean {
  if (a.type !== "annotation") return false;
  const id = a.namedChild(0);
  return !!id && text(id, source) === "onready";
}

/** Annotations attached to a declaration: same-line and preceding siblings. */
function siblingAnnotations(vs: Node): Node[] {
  const groups: Node[] = [];
  // Same line: `@onready var a = $A` (an `annotations` child).
  for (const c of vs.namedChildren) {
    if (c?.type === "annotations") groups.push(c);
  }
  // Own line(s) above: `@onready` / `@export_group(...)` parse as preceding
  // standalone `annotation` siblings. Keep walking past comments so an
  // `@onready` above a comment is still seen.
  for (let s = vs.previousNamedSibling; s && (s.type === "annotation" || s.type === "annotations" || s.type === "comment"); s = s.previousNamedSibling) {
    if (s.type === "annotation" || s.type === "annotations") groups.push(s);
  }
  return groups;
}

function hasOnready(vs: Node, source: string): boolean {
  for (const g of siblingAnnotations(vs)) {
    for (const a of walk(g)) if (isOnready(a, source)) return true;
  }
  return false;
}

function hasExport(vs: Node, source: string): boolean {
  for (const g of siblingAnnotations(vs)) {
    for (const a of walk(g)) {
      const id = a?.namedChild(0);
      if (id && text(id, source).startsWith("export")) return true;
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
      if (hasExport(vs, ctx.source)) {
        out.push({
          node: vs,
          message: "Node-path member initialized without @onready; @onready cannot combine with @export, and the exported value would be overwritten when the initializer runs.",
          suggestion: "Use an exported NodePath and resolve it in _ready(), or drop the node-path initializer.",
        });
        continue;
      }
      out.push({
        node: vs,
        message: "Node-path member initialized without @onready; the child may not exist when the initializer runs.",
        suggestion: "Prefix the declaration with @onready so it resolves after the node enters the tree.",
        fix: {
          description: "Add @onready",
          edits: [{ start: vs.startIndex, end: vs.startIndex, replacement: "@onready " }],
        },
      });
    }
    return out;
  },
};
