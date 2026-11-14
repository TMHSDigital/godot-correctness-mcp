import { describe, expect, it } from "vitest";
import { resolveConfig, type GodotCorrectnessConfig } from "../src/lint/config.js";
import { lintSource } from "../src/lint/engine.js";

/** Findings for one rule as "line:severity". */
async function hits(rule: string, source: string, raw: GodotCorrectnessConfig = {}): Promise<string[]> {
  return (await lintSource("x.gd", source, resolveConfig(raw)))
    .filter((f) => f.ruleId === rule)
    .map((f) => `${f.line}:${f.severity}`);
}

const fn = (name: string, body: string, ext = "Node2D"): string =>
  `extends ${ext}\n\nfunc ${name}(delta: float) -> void:\n${body
    .split("\n")
    .map((l) => `\t${l}`)
    .join("\n")}\n`;

describe("delta-misuse", () => {
  it("flags self.velocity = ... * delta with move_and_slide", async () => {
    expect(await hits("delta-misuse", fn("_physics_process", "self.velocity = Vector2.ONE * delta\nmove_and_slide()", "CharacterBody2D"))).toEqual(["4:error"]);
  });

  it("is quiet for the same assignment without move_and_slide", async () => {
    expect(await hits("delta-misuse", fn("_physics_process", "self.velocity = Vector2.ONE * delta", "CharacterBody2D"))).toEqual([]);
  });

  it("info for rotation/position changes without delta in _process; quiet with delta or in _ready", async () => {
    expect(await hits("delta-misuse", fn("_process", "rotation += 0.1"))).toEqual(["4:info"]);
    expect(await hits("delta-misuse", fn("_process", "position += Vector2.ONE * delta"))).toEqual([]);
    expect(await hits("delta-misuse", fn("_ready", "position.x += 5"))).toEqual([]);
  });

  it("a config severity override applies to both sub-patterns", async () => {
    const src =
      fn("_physics_process", "velocity = Vector2.ONE * delta\nmove_and_slide()", "CharacterBody2D") +
      "\nfunc _process(_d: float) -> void:\n\trotation += 0.1\n";
    expect(await hits("delta-misuse", src, { rules: { "delta-misuse": { severity: "warning" } } })).toEqual([
      "4:warning",
      "8:warning",
    ]);
  });
});

describe("connect-without-disconnect", () => {
  const ready = (line: string, extra = "") =>
    `extends Node\n\nfunc _ready() -> void:\n\t${line}\n${extra}\nfunc _on_x() -> void:\n\tpass\n`;

  it("flags a plain connect with no disconnect", async () => {
    expect(await hits("connect-without-disconnect", ready("pressed.connect(_on_x)"))).toEqual(["4:info"]);
  });

  it("is quiet for one-shot connections", async () => {
    expect(await hits("connect-without-disconnect", ready("pressed.connect(_on_x, CONNECT_ONE_SHOT)"))).toEqual([]);
    expect(await hits("connect-without-disconnect", ready("pressed.connect(_on_x, Object.CONNECT_ONE_SHOT)"))).toEqual([]);
  });

  it("any disconnect in the file silences it (documented conservatism)", async () => {
    const src = ready(
      "pressed.connect(_on_x)\n\tother.connect(_on_x)",
      "\nfunc _exit_tree() -> void:\n\tpressed.disconnect(_on_x)\n",
    );
    expect(await hits("connect-without-disconnect", src)).toEqual([]);
  });
});

describe("await-misuse", () => {
  const awaitOf = (expr: string) => `extends Node\n\nfunc f() -> void:\n\tawait ${expr}\n`;

  it.each(['"x"', "[1]", "{}", "true", "1.5", '&"s"', "1", "null"])("flags await %s", async (lit) => {
    expect(await hits("await-misuse", awaitOf(lit))).toEqual(["4:warning"]);
  });

  it.each(["sig", "f2()", "obj.sig", "get_tree().process_frame"])("is quiet for await %s", async (expr) => {
    expect(await hits("await-misuse", awaitOf(expr))).toEqual([]);
  });
});

describe("float-grid-equality", () => {
  const cmp = (expr: string) => `extends Node\n\nfunc f(v: Vector3, w: Vector2, x: float) -> bool:\n\treturn ${expr}\n`;

  it.each(["Vector3(0, 0, 0) == v", "w != Vector2(1, 2)", "x == 0.5"])("flags %s", async (expr) => {
    expect(await hits("float-grid-equality", cmp(expr))).toEqual(["4:info"]);
  });

  it.each(["w == Vector2.ZERO", "x < 0.5", "is_equal_approx(x, 0.5)"])("is quiet for %s", async (expr) => {
    expect(await hits("float-grid-equality", cmp(expr))).toEqual([]);
  });
});

describe("get-node-in-process", () => {
  it.each(['get_node_or_null("A")', 'self.get_node("A")', "%B", "$C"])("flags %s in _process", async (expr) => {
    expect(await hits("get-node-in-process", fn("_process", `var n = ${expr}`))).toEqual(["4:warning"]);
  });

  it("is quiet in _ready", async () => {
    expect(await hits("get-node-in-process", fn("_ready", 'var n = get_node("A")'))).toEqual([]);
  });
});

describe("missing-onready", () => {
  it("flags get_node_or_null initialisers", async () => {
    expect(await hits("missing-onready", 'extends Node\nvar a = get_node_or_null("A")\n')).toEqual(["2:warning"]);
  });

  it("is quiet for @export node references and inner-class members", async () => {
    expect(await hits("missing-onready", "extends Node\n@export var n: Node\n")).toEqual([]);
    // Inner classes are not nodes in the tree, so their members are not checked.
    expect(await hits("missing-onready", 'extends Node\nclass Inner:\n\tvar a = get_node("A")\n')).toEqual([]);
  });

  it("does not flag an @onready separated by a comment", async () => {
    expect(await hits("missing-onready", 'extends Node\n\n@onready\n# player sprite\nvar a: Node = $A\n')).toEqual([]);
  });

  it("flags @export members without attaching a fix", async () => {
    const src = "extends Node\n\n@export var c: Node = $C\n@export_enum(\"A\", \"B\")\n@export var d: Node = $D\n";
    const findings = (await lintSource("x.gd", src, resolveConfig())).filter((f) => f.ruleId === "missing-onready");
    expect(findings).toHaveLength(2);
    expect(findings.map((f) => !!f.fix)).toEqual([false, false]);
  });
});

describe("untyped-declaration", () => {
  it.each(["static var a = 1", "@export var b = 2"])("flags %s", async (decl) => {
    expect(await hits("untyped-declaration", `extends Node\n${decl}\n`)).toEqual(["2:warning"]);
  });

  it("is quiet for constants and loop variables", async () => {
    expect(await hits("untyped-declaration", "extends Node\nconst X = 1\n\nfunc f() -> void:\n\tfor i in range(3):\n\t\tprint(i)\n")).toEqual([]);
  });
});
