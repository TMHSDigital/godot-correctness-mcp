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
