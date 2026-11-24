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

function annotationName(a: Node, source: string): string | null {
  if (a.type !== "annotation") return null;
  const id = a.namedChild(0);
  return id ? text(id, source) : null;
}

/**
 * Annotations attached to this member, in document order: the same-line
 * `annotations` child, then any own-line `annotation` siblings above it.
 * Comments between an own-line annotation and the declaration are skipped;
 * any other sibling ends the run, so an annotation from an earlier,
 * separate declaration is never borrowed.
 */
function* memberAnnotations(vs: Node): Generator<Node> {
  // Same line: `@onready var a = $A` (an `annotations` child).
  for (const c of vs.namedChildren) {
    if (c?.type !== "annotations") continue;
    yield* walk(c);
  }
  // Own line(s) above: `@onready` / `@export ...` parse as preceding
  // standalone `annotation` siblings of the declaration.
  for (let s = vs.previousNamedSibling; s; s = s.previousNamedSibling) {
    if (s.type === "comment") continue;
    if (s.type !== "annotation" && s.type !== "annotations") break;
    yield* walk(s);
  }
}

function hasOnready(vs: Node, source: string): boolean {
  for (const a of memberAnnotations(vs)) {
    if (annotationName(a, source) === "onready") return true;
  }
  return false;
}

/** Grouping annotations describe the inspector layout, not the member. */
const GROUP_ANNOTATIONS = new Set(["export_group", "export_category", "export_subgroup"]);

/** True for `@export` / `@export_*` annotations that export this member. */
function isMemberExport(a: Node, source: string): boolean {
  const name = annotationName(a, source);
  if (!name) return false;
  if (name === "export") return true;
  return name.startsWith("export_") && !GROUP_ANNOTATIONS.has(name);
}

function hasMemberExport(vs: Node, source: string): boolean {
  for (const a of memberAnnotations(vs)) {
    if (isMemberExport(a, source)) return true;
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
      // Exported members: adding @onready would combine it with @export,
      // which Godot warns about (ONREADY_WITH_EXPORT) and which changes
      // when the inspector value applies. Flag it, but offer no auto-fix.
      if (hasMemberExport(vs, ctx.source)) {
        out.push({
          node: vs,
          message:
            "Exported node-path member initialized without @onready; the child may not exist when the initializer runs.",
          suggestion:
            "Resolve the node in _ready only when the inspector assigned no value, or export a NodePath instead. No automatic fix is offered: adding @onready would overwrite the assigned value.",
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
