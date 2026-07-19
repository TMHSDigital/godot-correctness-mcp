/**
 * CI + local artifact validation. Decompresses every committed symbol DB,
 * validates it against the zod schema, checks its version label, and prints a
 * summary. Exits non-zero on any failure. Never runs Godot.
 *
 * Run locally before pushing:  npm run validate:artifacts
 */
import { existsSync } from "node:fs";
import { PINNED_GODOT_VERSIONS } from "../src/capabilities.js";
import { dbPath, loadSymbolDbFromFile } from "../src/symbols/db.js";

let failures = 0;

for (const label of PINNED_GODOT_VERSIONS) {
  const path = dbPath(label);
  if (!existsSync(path)) {
    console.error(`MISSING  ${label}: ${path}`);
    failures++;
    continue;
  }
  try {
    const db = loadSymbolDbFromFile(path);
    if (db.meta.versionLabel !== label) {
      console.error(`MISMATCH ${label}: meta.versionLabel is "${db.meta.versionLabel}"`);
      failures++;
      continue;
    }
    console.log(
      `OK       ${label}: Godot ${db.meta.godotVersion} (${db.meta.releaseTag}), ` +
        `${Object.keys(db.classes).length} classes, ` +
        `${Object.keys(db.builtinClasses).length} builtins, ` +
        `${db.utilityFunctions.length} utility functions, ` +
        `sha256=${db.meta.archiveSha256 ?? "n/a"}`,
    );
  } catch (err) {
    console.error(`INVALID  ${label}: ${err instanceof Error ? err.message : String(err)}`);
    failures++;
  }
}

if (failures > 0) {
  console.error(`\n${failures} symbol DB artifact validation failure(s).`);
  process.exit(1);
}
console.log("\nAll symbol DB artifacts valid.");
