/**
 * Index of a GDScript line's `#` comment start, ignoring `#` inside string
 * literals (single- or double-quoted, with backslash escapes). -1 when the line
 * has no comment.
 */
export function commentStart(line: string): number {
  let inStr: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inStr) {
      if (c === "\\") i++;
      else if (c === inStr) inStr = null;
    } else if (c === '"' || c === "'") inStr = c;
    else if (c === "#") return i;
  }
  return -1;
}

/**
 * Index where each line's code starts, carrying triple-quoted string state
 * (`"""` / `'''`) across lines: 0 for a line that begins in code, the index
 * just past the closing quotes for a line that begins inside a multi-line
 * string, or -1 when the whole line is inside one. Text inside a multi-line
 * string is not code, so checks must start their scan at this index.
 */
export function codeStarts(source: string): number[] {
  const out: number[] = [];
  let triple: string | null = null;
  for (const line of source.split(/\r?\n/)) {
    let start = 0;
    if (triple) {
      // The line begins inside a multi-line string; find its closing quotes.
      let i = 0;
      let closed = false;
      while (i < line.length) {
        const c = line[i]!;
        if (c === "\\") {
          i += 2;
          continue;
        }
        if (line.startsWith(triple, i)) {
          i += 3;
          closed = true;
          break;
        }
        i++;
      }
      if (!closed) {
        out.push(-1);
        continue;
      }
      start = i;
      triple = null;
    }
    // Track triple-quoted strings the rest of the line opens so the next
    // line's start state is right; a `#` ends the code part of the line.
    let inStr: string | null = null;
    for (let i = start; i < line.length; i++) {
      const c = line[i]!;
      if (inStr) {
        if (c === "\\") i++;
        else if (c === inStr) inStr = null;
      } else if (c === '"' || c === "'") {
        if (line.startsWith(c.repeat(3), i)) {
          triple = c.repeat(3);
          i += 2;
        } else inStr = c;
      } else if (c === "#") break;
    }
    out.push(start);
  }
  return out;
}

/**
 * `commentStart` for every line of a source, carrying triple-quoted string
 * state (`"""` / `'''`) across lines, so a `#` inside a multi-line string is
 * not a comment.
 */
export function commentStarts(source: string): number[] {
  const out: number[] = [];
  let triple: string | null = null;
  for (const line of source.split(/\r?\n/)) {
    let found = -1;
    let inStr: string | null = null;
    for (let i = 0; i < line.length; i++) {
      const c = line[i]!;
      if (triple) {
        if (c === "\\") i++;
        else if (line.startsWith(triple, i)) {
          triple = null;
          i += 2;
        }
      } else if (inStr) {
        if (c === "\\") i++;
        else if (c === inStr) inStr = null;
      } else if (c === '"' || c === "'") {
        if (line.startsWith(c.repeat(3), i)) {
          triple = c.repeat(3);
          i += 2;
        } else inStr = c;
      } else if (c === "#") {
        found = i;
        break;
      }
    }
    out.push(found);
  }
  return out;
}
