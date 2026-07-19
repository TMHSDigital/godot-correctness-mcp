import type { Node } from "web-tree-sitter";

/** Depth-first walk over all named nodes (inclusive of the start node). */
export function* walk(node: Node): Generator<Node> {
  yield node;
  for (const child of node.namedChildren) {
    if (child) yield* walk(child);
  }
}

/** Source text covered by a node. */
export function text(node: Node, source: string): string {
  return source.slice(node.startIndex, node.endIndex);
}

/** All named descendants of a given grammar type. */
export function findAll(root: Node, type: string): Node[] {
  const out: Node[] = [];
  for (const n of walk(root)) if (n.type === type) out.push(n);
  return out;
}

/** Text of a named field child, or null. */
export function fieldText(node: Node, field: string, source: string): string | null {
  const child = node.childForFieldName(field);
  return child ? text(child, source) : null;
}

/** The operator token of a binary/assignment node (read from source between operands). */
export function operatorOf(node: Node, source: string): string | null {
  const left = node.childForFieldName("left");
  const right = node.childForFieldName("right");
  if (!left || !right) return null;
  return source.slice(left.endIndex, right.startIndex).trim();
}

/** Walk up to the nearest enclosing function_definition, or null. */
export function enclosingFunction(node: Node): Node | null {
  let cur: Node | null = node.parent;
  while (cur) {
    if (cur.type === "function_definition") return cur;
    cur = cur.parent;
  }
  return null;
}

/** Name of the enclosing function_definition, or null if not inside one. */
export function enclosingFunctionName(node: Node, source: string): string | null {
  const fn = enclosingFunction(node);
  return fn ? fieldText(fn, "name", source) : null;
}

/**
 * The identifier being invoked by a call. Handles both free calls
 * `foo(...)` (a `call` node) and method calls `a.b.foo(...)` (an
 * `attribute_call` node). Returns the method/function name or null.
 */
export function calleeName(node: Node, source: string): string | null {
  if (node.type === "call") {
    const fn = node.namedChild(0);
    return fn && fn.type === "identifier" ? text(fn, source) : null;
  }
  if (node.type === "attribute_call") {
    const id = node.namedChild(0);
    return id && id.type === "identifier" ? text(id, source) : null;
  }
  return null;
}

/** True if the subtree contains an identifier with the given name. */
export function containsIdentifier(node: Node, name: string, source: string): boolean {
  for (const n of walk(node)) {
    if (n.type === "identifier" && text(n, source) === name) return true;
  }
  return false;
}

/** True if the function body calls a function/method with the given name. */
export function functionCalls(fn: Node, name: string, source: string): boolean {
  for (const n of walk(fn)) {
    if ((n.type === "call" || n.type === "attribute_call") && calleeName(n, source) === name) {
      return true;
    }
  }
  return false;
}
