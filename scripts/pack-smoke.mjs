#!/usr/bin/env node
// Smoke-test the published artifact: `npm pack`, install the tarball into a
// throwaway project, and run the installed binaries the way users do. Catches
// files missing from package.json "files" (data/, skills/, the grammar WASM)
// and broken bin shims, which the source-tree test suite cannot see.
//
// Usage: npm run build && node scripts/pack-smoke.mjs
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repo = resolve(import.meta.dirname, "..");
const isWin = process.platform === "win32";
const npm = (args, cwd) =>
  execFileSync(isWin ? "npm.cmd" : "npm", args, { cwd, encoding: "utf-8", shell: isWin, stdio: ["ignore", "pipe", "inherit"] });

const work = mkdtempSync(join(tmpdir(), "gdc-pack-"));
let failed = false;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
  if (!ok) failed = true;
};

try {
  const [{ filename }] = JSON.parse(npm(["pack", "--json", "--pack-destination", work], repo));
  writeFileSync(join(work, "package.json"), JSON.stringify({ name: "pack-smoke", private: true }));
  npm(["install", "--no-audit", "--no-fund", join(work, filename)], work);

  // Run the installed bins through npm exec, i.e. the node_modules/.bin shims.
  const bin = (name, args) =>
    spawnSync(isWin ? "npm.cmd" : "npm", ["exec", "--no", "--", name, ...args], {
      cwd: work,
      encoding: "utf-8",
      shell: isWin,
    });

  const lint = bin("gdcorrect", ["lint", join(repo, "test/fixtures/lint-project")]);
  check("gdcorrect lint exits 1 on the lint fixture", lint.status === 1, `exit ${lint.status}`);
  check("lint output is JSON with findings", /"findings"/.test(lint.stdout));

  const clean = bin("gdcorrect", ["lint", join(repo, "test/fixtures/clean-project")]);
  check("gdcorrect lint exits 0 on the clean fixture", clean.status === 0, `exit ${clean.status}`);

  const version = bin("gdcorrect", ["--version"]);
  check("gdcorrect --version prints the package version", /^\d+\.\d+\.\d+/.test(version.stdout.trim()), version.stdout.trim());

  // MCP server over stdio: initialize, then call server_info and a symbol lookup.
  const messages = [
    { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "smoke", version: "0" } } },
    { jsonrpc: "2.0", method: "notifications/initialized" },
    { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "server_info", arguments: {} } },
    { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "api_symbol_lookup", arguments: { symbol: "move_and_slide" } } },
    { jsonrpc: "2.0", id: 4, method: "resources/read", params: { uri: "skill://typed-gdscript" } },
  ];
  const server = spawnSync(isWin ? "npm.cmd" : "npm", ["exec", "--no", "--", "godot-correctness-mcp"], {
    cwd: work,
    input: messages.map((m) => JSON.stringify(m)).join("\n") + "\n",
    encoding: "utf-8",
    shell: isWin,
    timeout: 60_000,
  });
  const replies = new Map(
    server.stdout
      .split(/\r?\n/)
      .filter((l) => l.startsWith("{"))
      .map((l) => JSON.parse(l))
      .filter((m) => m.id !== undefined)
      .map((m) => [m.id, m]),
  );
  const info = replies.get(2)?.result?.content?.[0]?.text ?? "";
  check("server_info reports every pillar available", /"gdscriptLint":\s*true/.test(info) && /"apiSymbols":\s*true/.test(info));
  const lookup = replies.get(3)?.result?.content?.[0]?.text ?? "";
  check("api_symbol_lookup finds move_and_slide", lookup.includes("CharacterBody2D"));
  const skill = replies.get(4)?.result?.contents?.[0]?.text ?? "";
  check("skill resources are packaged", skill.startsWith("#"));
} finally {
  rmSync(work, { recursive: true, force: true });
}

if (failed) {
  console.error("pack smoke test failed");
  process.exit(1);
}
console.log("pack smoke test passed");
