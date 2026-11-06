import type { Node } from "web-tree-sitter";

export type Severity = "error" | "warning" | "info";

/** A resolved finding, ready for JSON output. Line/col are 1-based. */
export interface Finding {
  file: string;
  line: number;
  col: number;
  ruleId: string;
  severity: Severity;
  message: string;
  suggestion: string;
  /** A machine-applicable fix, for findings with a deterministic rewrite. */
  fix?: Fix;
}

/** One text replacement. Positions are 1-based; the end is exclusive. */
export interface FixEdit {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
  replacement: string;
}

export interface Fix {
  /** What applying the fix does, e.g. "Add @onready". */
  description: string;
  /** Non-overlapping edits, in document order. */
  edits: FixEdit[];
}

/** A fix as a rule produces it: string offsets into the source (end exclusive). */
export interface RawFix {
  description: string;
  edits: { start: number; end: number; replacement: string }[];
}

/** What a rule emits: a node to anchor at, a message, and a fix suggestion. */
export interface RawFinding {
  node: Node;
  message: string;
  suggestion: string;
  /**
   * Intrinsic severity for this specific finding, used for rules that emit more
   * than one severity (e.g. delta-misuse: error for the main pattern, info for
   * the softer sub-pattern). Takes precedence over the rule default, but a
   * config severity override still wins.
   */
  severity?: Severity;
  /** Optional deterministic rewrite; only for rewrites that cannot change behaviour. */
  fix?: RawFix;
}

export interface RuleContext {
  root: Node;
  source: string;
  /** Per-rule options merged from config. */
  options: Record<string, unknown>;
  /** Godot version declared in the project's project.godot, if any. */
  projectGodotVersion?: string | null;
}

export interface Rule {
  id: string;
  description: string;
  defaultSeverity: Severity;
  check(ctx: RuleContext): RawFinding[];
}
