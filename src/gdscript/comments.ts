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
