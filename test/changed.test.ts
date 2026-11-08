import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { changedSince } from "../src/project/changed.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

it("preserves non-ASCII tracked and untracked paths within a project subdirectory", () => {
  const root = mkdtempSync(join(tmpdir(), "gdc-changed-"));
  roots.push(root);
  const git = (...args: string[]): void => {
    execFileSync("git", ["-C", root, ...args], { stdio: "pipe" });
  };
  git("init");
  git("config", "user.name", "Test");
  git("config", "user.email", "test@example.invalid");
  git("config", "core.quotePath", "true");
  const project = join(root, "game");
  mkdirSync(project);
  writeFileSync(join(project, "jogador_é.gd"), "var a = 1\n");
  writeFileSync(join(project, "unchanged.gd"), "var a = 1\n");
  git("add", ".");
  git("-c", "commit.gpgsign=false", "commit", "-m", "initial");
  writeFileSync(join(project, "jogador_é.gd"), "var a = 2\n");
  writeFileSync(join(project, "玩家.gd"), "var a = 2\n");
  writeFileSync(join(root, "outside.gd"), "var a = 2\n");
  expect(changedSince(project, "HEAD").sort()).toEqual(["jogador_é.gd", "玩家.gd"].sort());
});

it.skipIf(process.platform === "win32")("preserves quoted, tabbed and newline paths", () => {
  const root = mkdtempSync(join(tmpdir(), "gdc-changed-"));
  roots.push(root);
  const git = (...args: string[]): void => {
    execFileSync("git", ["-C", root, ...args], { stdio: "pipe" });
  };
  git("init");
  git("config", "user.name", "Test");
  git("config", "user.email", "test@example.invalid");
  writeFileSync(join(root, "tracked\nname.gd"), "var a = 1\n");
  git("add", ".");
  git("-c", "commit.gpgsign=false", "commit", "-m", "initial");
  writeFileSync(join(root, "tracked\nname.gd"), "var a = 2\n");
  const names = ['quote"name.gd', "tab\tname.gd", "untracked\nname.gd"];
  for (const name of names) writeFileSync(join(root, name), "var a = 2\n");
  expect(changedSince(root, "HEAD").sort()).toEqual([...names, "tracked\nname.gd"].sort());
});
