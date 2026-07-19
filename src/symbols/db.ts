import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { PINNED_GODOT_VERSIONS } from "../capabilities.js";
import { parseSymbolDb, type SymbolDb } from "./schema.js";

// dist/symbols/db.js and src/symbols/db.ts both sit two levels below the
// package root, so data/ resolves the same compiled or via tsx/vitest.
const dataDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "data");

const cache = new Map<string, SymbolDb>();

/** Path to the committed gzipped symbol DB for a version label ("4.4"/"4.5"). */
export function dbPath(label: string): string {
  return join(dataDir, `godot-${label}.symbols.json.gz`);
}

/** Whether a symbol DB artifact is present for the given version label. */
export function isVersionAvailable(label: string): boolean {
  return existsSync(dbPath(label));
}

/** Pinned versions that actually have a committed artifact. */
export function availableVersions(): string[] {
  return PINNED_GODOT_VERSIONS.filter(isVersionAvailable);
}

/** Decompress, parse, and validate a DB from an explicit file path. */
export function loadSymbolDbFromFile(path: string): SymbolDb {
  const raw = JSON.parse(gunzipSync(readFileSync(path)).toString("utf-8")) as unknown;
  return parseSymbolDb(raw);
}

/** Load (and cache) the committed symbol DB for a version label. */
export function loadSymbolDb(label: string): SymbolDb {
  const cached = cache.get(label);
  if (cached) return cached;
  const path = dbPath(label);
  if (!existsSync(path)) {
    throw new Error(
      `No symbol database for Godot ${label}. Expected ${path}. ` +
        `Available: ${availableVersions().join(", ") || "none"}.`,
    );
  }
  const db = loadSymbolDbFromFile(path);
  cache.set(label, db);
  return db;
}
