/**
 * Dev-time only. Generates a compact, gzipped Godot symbol database from a
 * local Godot binary. CI never runs this; it validates the committed artifacts
 * instead (see scripts/validate-symbol-db.ts). See docs/symbol-db.md for the
 * regeneration procedure.
 *
 * Usage:
 *   tsx scripts/generate-symbol-db.ts \
 *     --godot "E:/godot-toolchain/godot-4.4.1/Godot_v4.4.1-stable_win64_console.exe" \
 *     --label 4.4 \
 *     --tag 4.4.1-stable \
 *     --archive-name Godot_v4.4.1-stable_win64.exe.zip \
 *     --archive-sha256 <hex> \
 *     [--source godotengine/godot-builds] [--out data]
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { parseSymbolDb, SCHEMA_VERSION, type SymbolDb } from "../src/symbols/schema.js";

interface Args {
  godot: string;
  label: string;
  tag: string | null;
  archiveName: string | null;
  archiveSha256: string | null;
  source: string;
  out: string;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const godot = get("--godot");
  const label = get("--label");
  if (!godot || !label) {
    throw new Error("Required: --godot <path> --label <4.4|4.5>");
  }
  return {
    godot,
    label,
    tag: get("--tag") ?? null,
    archiveName: get("--archive-name") ?? null,
    archiveSha256: get("--archive-sha256") ?? null,
    source: get("--source") ?? "godotengine/godot-builds",
    out: get("--out") ?? "data",
  };
}

type Raw = Record<string, unknown>;

function mapArg(a: Raw): Record<string, unknown> {
  const out: Record<string, unknown> = { name: a["name"], type: a["type"] };
  if (a["default_value"] !== undefined) out["default"] = String(a["default_value"]);
  return out;
}

function flag(cond: unknown, key: string): Record<string, boolean> {
  return cond ? { [key]: true } : {};
}

function mapEnum(e: Raw): Record<string, unknown> {
  return {
    name: e["name"],
    ...flag(e["is_bitfield"], "isBitfield"),
    values: (e["values"] as Raw[]).map((v) => ({ name: v["name"], value: v["value"] })),
  };
}

function mapClassMethod(m: Raw): Record<string, unknown> {
  const rv = m["return_value"] as Raw | undefined;
  return {
    name: m["name"],
    ret: rv?.["type"] ?? null,
    args: ((m["arguments"] as Raw[]) ?? []).map(mapArg),
    ...flag(m["is_const"], "isConst"),
    ...flag(m["is_static"], "isStatic"),
    ...flag(m["is_virtual"], "isVirtual"),
    ...flag(m["is_vararg"], "isVararg"),
  };
}

function mapBuiltinMethod(m: Raw): Record<string, unknown> {
  return {
    name: m["name"],
    ret: (m["return_type"] as string | undefined) ?? null,
    args: ((m["arguments"] as Raw[]) ?? []).map(mapArg),
    ...flag(m["is_const"], "isConst"),
    ...flag(m["is_static"], "isStatic"),
    ...flag(m["is_vararg"], "isVararg"),
  };
}

function transform(api: Raw, args: Args): SymbolDb {
  const h = api["header"] as Raw;
  const classes: Record<string, unknown> = {};
  for (const c of api["classes"] as Raw[]) {
    classes[c["name"] as string] = {
      inherits: (c["inherits"] as string | undefined) ?? null,
      apiType: c["api_type"],
      ...flag(c["is_refcounted"], "isRefcounted"),
      ...flag(c["is_instantiable"], "isInstantiable"),
      methods: ((c["methods"] as Raw[]) ?? []).map(mapClassMethod),
      properties: ((c["properties"] as Raw[]) ?? []).map((p) => ({
        name: p["name"],
        type: p["type"],
        ...(p["getter"] ? { getter: p["getter"] } : {}),
        ...(p["setter"] ? { setter: p["setter"] } : {}),
      })),
      signals: ((c["signals"] as Raw[]) ?? []).map((s) => ({
        name: s["name"],
        args: ((s["arguments"] as Raw[]) ?? []).map(mapArg),
      })),
      enums: ((c["enums"] as Raw[]) ?? []).map(mapEnum),
      constants: ((c["constants"] as Raw[]) ?? []).map((k) => ({
        name: k["name"],
        value: k["value"],
      })),
    };
  }

  const builtinClasses: Record<string, unknown> = {};
  for (const b of api["builtin_classes"] as Raw[]) {
    builtinClasses[b["name"] as string] = {
      members: ((b["members"] as Raw[]) ?? []).map((m) => ({ name: m["name"], type: m["type"] })),
      constants: ((b["constants"] as Raw[]) ?? []).map((k) => ({
        name: k["name"],
        type: k["type"],
        value: String(k["value"]),
      })),
      enums: ((b["enums"] as Raw[]) ?? []).map(mapEnum),
      operators: ((b["operators"] as Raw[]) ?? []).map((o) => ({
        name: o["name"],
        right: (o["right_type"] as string | undefined) ?? null,
        ret: o["return_type"],
      })),
      methods: ((b["methods"] as Raw[]) ?? []).map(mapBuiltinMethod),
      ...flag(b["is_keyed"], "isKeyed"),
    };
  }

  const db = {
    meta: {
      godotVersion: `${h["version_major"]}.${h["version_minor"]}.${h["version_patch"]}`,
      versionLabel: args.label,
      versionFull: String(h["version_full_name"]).replace(/^Godot Engine v/, ""),
      releaseTag: args.tag,
      archiveName: args.archiveName,
      archiveSha256: args.archiveSha256,
      source: args.source,
      schemaVersion: SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
    },
    classes,
    builtinClasses,
    utilityFunctions: (api["utility_functions"] as Raw[]).map((u) => ({
      name: u["name"],
      ret: (u["return_type"] as string | undefined) ?? null,
      category: u["category"],
      args: ((u["arguments"] as Raw[]) ?? []).map(mapArg),
      ...flag(u["is_vararg"], "isVararg"),
    })),
    globalEnums: (api["global_enums"] as Raw[]).map(mapEnum),
    singletons: (api["singletons"] as Raw[]).map((s) => ({ name: s["name"], type: s["type"] })),
  };

  // Validate before writing: a malformed transform must fail here, never ship.
  return parseSymbolDb(db);
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(args.godot)) throw new Error(`Godot binary not found: ${args.godot}`);

  const workDir = mkdtempSync(join(tmpdir(), "godot-api-"));
  try {
    console.error(`Dumping extension API from ${args.godot} ...`);
    const res = spawnSync(args.godot, ["--headless", "--dump-extension-api"], {
      cwd: workDir,
      encoding: "utf-8",
    });
    if (res.status !== 0) {
      throw new Error(`Godot exited ${res.status}: ${res.stderr ?? ""}`);
    }
    const apiPath = join(workDir, "extension_api.json");
    if (!existsSync(apiPath)) throw new Error(`extension_api.json not produced in ${workDir}`);

    const api = JSON.parse(readFileSync(apiPath, "utf-8")) as Raw;
    const db = transform(api, args);

    mkdirSync(args.out, { recursive: true });
    const outPath = join(args.out, `godot-${args.label}.symbols.json.gz`);
    const gz = gzipSync(Buffer.from(JSON.stringify(db)), { level: 9 });
    writeFileSync(outPath, gz);

    console.error(
      `Wrote ${outPath} (${gz.length} bytes) for Godot ${db.meta.godotVersion} ` +
        `(${Object.keys(db.classes).length} classes, ` +
        `${Object.keys(db.builtinClasses).length} builtins, ` +
        `${db.utilityFunctions.length} utility functions).`,
    );
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

main();
