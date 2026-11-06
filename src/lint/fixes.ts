import type { Finding, FixEdit } from "./types.js";

function lineStarts(source: string): number[] {
  const starts = [0];
  for (let i = 0; i < source.length; i++) if (source[i] === "\n") starts.push(i + 1);
  return starts;
}

/**
 * Apply the fixes attached to `findings` to one file's source. A fix whose
 * edits overlap an already-applied fix is skipped (its finding stays for the
 * next run). Returns the new source and how many fixes were applied.
 */
export function applyFixes(source: string, findings: Finding[]): { source: string; applied: number } {
  const starts = lineStarts(source);
  const offset = (line: number, col: number): number => (starts[line - 1] ?? source.length) + col - 1;

  const taken: [number, number][] = [];
  const edits: { start: number; end: number; replacement: string }[] = [];
  let applied = 0;
  for (const f of findings) {
    if (!f.fix) continue;
    const ranges = f.fix.edits.map((e: FixEdit) => ({
      start: offset(e.startLine, e.startCol),
      end: offset(e.endLine, e.endCol),
      replacement: e.replacement,
    }));
    const overlaps = ranges.some((r) =>
      taken.some(([s, e]) => r.start < e && s < r.end || (r.start === r.end && r.start === s && s === e)),
    );
    if (overlaps) continue;
    for (const r of ranges) {
      taken.push([r.start, r.end]);
      edits.push(r);
    }
    applied++;
  }
  // Apply back to front so earlier offsets stay valid.
  edits.sort((a, b) => b.start - a.start || b.end - a.end);
  let out = source;
  for (const e of edits) out = out.slice(0, e.start) + e.replacement + out.slice(e.end);
  return { source: out, applied };
}
