import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadSymbolDb } from "../src/symbols/db.js";
import {
  classSummary,
  diffClass,
  diffSymbol,
  lookupSymbol,
} from "../src/symbols/lookup.js";
import { parseSymbolDb, type SymbolDb } from "../src/symbols/schema.js";

function loadFixture(name: string): SymbolDb {
  const path = fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
  return parseSymbolDb(JSON.parse(readFileSync(path, "utf-8")) as unknown);
}

const db44 = loadFixture("fixture-4.4.json");
const db45 = loadFixture("fixture-4.5.json");

describe("lookupSymbol (fixtures)", () => {
  it("finds a method by bare name with its owner and signature", () => {
    const r = lookupSymbol(db44, "move_and_slide");
    expect(r.matches).toHaveLength(1);
    expect(r.matches[0]).toMatchObject({ kind: "method", owner: "CharacterBody2D", name: "move_and_slide" });
    expect(r.matches[0]?.signature).toContain("-> bool");
  });

  it("resolves a qualified Owner.member query", () => {
    const r = lookupSymbol(db44, "CharacterBody2D.velocity");
    expect(r.matches).toHaveLength(1);
    expect(r.matches[0]).toMatchObject({ kind: "property", owner: "CharacterBody2D", name: "velocity" });
    expect(r.matches[0]?.signature).toContain("Vector2");
  });

  it("finds a class by name", () => {
    const r = lookupSymbol(db44, "Node");
    expect(r.matches.some((m) => m.kind === "class" && m.name === "Node")).toBe(true);
  });

  it("returns closest-match suggestions on a miss", () => {
    const r = lookupSymbol(db44, "move_and_slid");
    expect(r.matches).toHaveLength(0);
    expect(r.suggestions?.map((s) => s.name)).toContain("move_and_slide");
  });

  it("respects a kind filter", () => {
    const r = lookupSymbol(db44, "Node", { kind: "class" });
    expect(r.matches.every((m) => m.kind === "class")).toBe(true);
  });
});

describe("classSummary (fixtures)", () => {
  it("lists members and the full inheritance chain", () => {
    const s = classSummary(db44, "CharacterBody2D");
    expect(s).toBeDefined();
    expect(s?.inheritanceChain).toEqual(["Node", "Object"]);
    expect(s?.methods.some((m) => m.includes("move_and_slide"))).toBe(true);
    expect(s?.properties.some((p) => p.includes("velocity"))).toBe(true);
  });

  it("is case-insensitive and returns undefined for unknown classes", () => {
    expect(classSummary(db44, "characterbody2d")?.name).toBe("CharacterBody2D");
    expect(classSummary(db44, "NoSuchClass")).toBeUndefined();
  });
});

describe("diffClass (fixtures 4.4 -> 4.5)", () => {
  const d = diffClass(db44, db45, "CharacterBody2D");

  it("detects added, removed, and signature-changed methods", () => {
    expect(d.methods.added.some((s) => s.includes("get_platform_velocity"))).toBe(true);
    expect(d.methods.removed.some((s) => s.includes("deprecated_helper"))).toBe(true);
    const changed = d.methods.changed.find((c) => c.name === "move_and_slide");
    expect(changed).toBeDefined();
    expect(changed?.old).not.toBe(changed?.new);
    expect(changed?.new).toContain("stop_on_slope");
  });

  it("reports the class as present in both and not identical", () => {
    expect(d.presence.inFrom).toBe(true);
    expect(d.presence.inTo).toBe(true);
    expect(d.identical).toBe(false);
  });

  it("flags a class added in the newer version", () => {
    const added = diffClass(db44, db45, "SkeletonModifier3D");
    expect(added.presence.inFrom).toBe(false);
    expect(added.presence.inTo).toBe(true);
    expect(added.methods.added.length).toBeGreaterThan(0);
  });

  it("only fires on genuine changes (does not flag stable members)", () => {
    // is_on_floor is identical across versions; must not appear in any bucket.
    const all = [...d.methods.added, ...d.methods.removed, ...d.methods.changed.map((c) => c.name)];
    expect(all.some((s) => s.includes("is_on_floor"))).toBe(false);
  });
});

describe("diffSymbol (fixtures)", () => {
  it("reports a changed method with both signatures side by side", () => {
    const d = diffSymbol(db44, db45, "move_and_slide");
    const entry = d.entries.find((e) => e.owner === "CharacterBody2D");
    expect(entry?.status).toBe("changed");
    expect(entry?.fromSignature).toBeTruthy();
    expect(entry?.toSignature).toBeTruthy();
    expect(entry?.fromSignature).not.toBe(entry?.toSignature);
  });

  it("reports a removed member", () => {
    const d = diffSymbol(db44, db45, "deprecated_helper");
    const entry = d.entries.find((e) => e.name === "deprecated_helper");
    expect(entry?.status).toBe("removed");
    expect(entry?.toSignature).toBeNull();
  });
});

describe("committed artifacts (real DBs)", () => {
  for (const label of ["4.4", "4.5"] as const) {
    it(`loads and validates the ${label} symbol DB`, () => {
      const db = loadSymbolDb(label);
      expect(db.meta.versionLabel).toBe(label);
      expect(Object.keys(db.classes).length).toBeGreaterThan(900);
      expect(db.classes["CharacterBody2D"]).toBeDefined();
    });
  }

  it("diffs a real class across the committed versions", () => {
    const d = diffClass(loadSymbolDb("4.4"), loadSymbolDb("4.5"), "Node");
    expect(d.presence.inFrom).toBe(true);
    expect(d.presence.inTo).toBe(true);
  });
});
