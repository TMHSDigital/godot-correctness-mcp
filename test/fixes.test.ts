import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import { runCli } from "../src/cli.js";
import { resolveConfig } from "../src/lint/config.js";
import * as engine from "../src/lint/engine.js";
import { lintSource } from "../src/lint/engine.js";
import { applyFixes } from "../src/lint/fixes.js";
import { toSarif } from "../src/sarif.js";

const config = resolveConfig();
const tmp = mkdtempSync(join(tmpdir(), "gdc-fix-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

/** Lint, apply every fix, and return the fixed source and the re-linted rule ids. */
async function roundTrip(source: string): Promise<{ fixed: string; after: string[] }> {
  const findings = await lintSource("x.gd", source, config);
  const fixed = applyFixes(source, findings).source;
  const after = (await lintSource("x.gd", fixed, config)).map((f) => f.ruleId);
  return { fixed, after };
}

describe("machine-applicable fixes", () => {
  it("missing-onready: adds @onready", async () => {
    const src = "extends Node\n\nvar label: Label = $Label\n@export var other: Node = get_node(\"Other\")\n";
    const { fixed, after } = await roundTrip(src);
    expect(fixed).toBe(
      "extends Node\n\n@onready var label: Label = $Label\n@export var other: Node = $Other\n",
    );
    // The exported member is still flagged (no fix), so it survives the round-trip.
    expect(after).toContain("missing-onready");
    expect(after).not.toContain("stringly-nodepath");
  });

  it("stringly-nodepath: rewrites bare get_node with a plain path to $ shorthand only", async () => {
    const src =
      "extends Node\n\nfunc _ready() -> void:\n" +
      '\tvar a: Node = get_node("A/B_2")\n' +
      '\tvar b: Node = get_node("../Sibling")\n' + // relative-up path: not rewritten
      '\tvar c: Node = get_node_or_null("C")\n' + // different semantics: not rewritten
      '\tvar d: Node = self.get_node("D")\n' + // receiver: not rewritten
      "\ta.show()\n\tb.show()\n\tc.show()\n\td.show()\n";
    const findings = (await lintSource("x.gd", src, config)).filter((f) => f.ruleId === "stringly-nodepath");
    expect(findings.map((f) => !!f.fix)).toEqual([true, false, false, false]);
    expect(findings[0]!.fix).toEqual({
      description: "Use $A/B_2",
      edits: [{ startLine: 4, startCol: 16, endLine: 4, endCol: 33, replacement: "$A/B_2" }],
    });
    const { fixed } = await roundTrip(src);
    expect(fixed).toContain("\tvar a: Node = $A/B_2\n");
    expect(fixed).toContain('get_node("../Sibling")');
  });

  it("positions are correct with CRLF line endings", async () => {
    const src = "extends Node\r\n\r\nvar label: Label = $Label\r\n";
    const { fixed } = await roundTrip(src);
    expect(fixed).toBe("extends Node\r\n\r\n@onready var label: Label = $Label\r\n");
  });

  it("emits SARIF fixes", async () => {
    const findings = await lintSource("x.gd", "extends Node\nvar l: Label = $L\n", config);
    const sarif = toSarif(findings, { projectRoot: tmp, version: "0.0.0", cwd: tmp }) as {
      runs: { results: { ruleId: string; fixes?: unknown[] }[] }[];
    };
    const r = sarif.runs[0]!.results.find((x) => x.ruleId === "missing-onready")!;
    expect(r.fixes).toEqual([
      {
        description: { text: "Add @onready" },
        artifactChanges: [
          {
            artifactLocation: { uri: "x.gd", uriBaseId: "%SRCROOT%" },
            replacements: [
              {
                deletedRegion: { startLine: 2, startColumn: 1, endLine: 2, endColumn: 1 },
                insertedContent: { text: "@onready " },
              },
            ],
          },
        ],
      },
    ]);
  });

  it("gdcorrect lint --fix rewrites files and reports what remains", async () => {
    const root = join(tmp, "fix-cli");
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, "a.gd"), "extends Node\n\nvar l: Label = $L\nvar untyped = 1\n");
    let out = "";
    let err = "";
    const code = await runCli(["lint", root, "--fix"], (s) => (out += s), (s) => (err += s));
    expect(code).toBe(0);
    expect(err).toContain("applied 1 fix(es) in 1 file(s)");
    expect(readFileSync(join(root, "a.gd"), "utf-8")).toBe("extends Node\n\n@onready var l: Label = $L\nvar untyped = 1\n");
    expect(JSON.parse(out).findings.map((f: { ruleId: string }) => f.ruleId)).toEqual(["untyped-declaration"]);
    expect(await runCli(["report", root, "--fix"], () => {}, () => {})).toBe(2);
  });

  it("gdcorrect lint --fix only re-lints modified files and matches a full re-run", async () => {
    const root = join(tmp, "fix-relint-subset");
    mkdirSync(root, { recursive: true });
    // a.gd has a fixable missing-onready and an untyped-declaration
    writeFileSync(join(root, "a.gd"), "extends Node\n\nvar l: Label = $L\nvar untyped = 1\n");
    // b.gd has an untyped-declaration and no fixable issues
    writeFileSync(join(root, "b.gd"), "extends Node\n\nvar untyped_b = 2\n");

    let out = "";
    let err = "";
    const spy = vi.spyOn(engine, "lintSource");
    let code: number;
    let relsLinted: string[];
    try {
      code = await runCli(["lint", root, "--fix"], (s) => (out += s), (s) => (err += s));
      relsLinted = spy.mock.calls.map((c) => c[0]);
    } finally {
      spy.mockRestore();
    }

    expect(code).toBe(0);
    expect(err).toContain("applied 1 fix(es) in 1 file(s)");
    // Initial lint: a.gd and b.gd. Post-fix re-lint: only the rewritten a.gd.
    expect(relsLinted).toEqual(["a.gd", "b.gd", "a.gd"]);

    // Verify output is identical to a fresh full run on the resulting state
    let freshOut = "";
    const freshCode = await runCli(["lint", root], (s) => (freshOut += s), () => {});
    expect(code).toBe(freshCode);

    const parsedOut = JSON.parse(out);
    const parsedFresh = JSON.parse(freshOut);
    expect(parsedOut).toEqual(parsedFresh);
  });
});
