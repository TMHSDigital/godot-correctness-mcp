import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PINNED_GODOT_VERSIONS,
  pillarAvailability,
  type PillarAvailability,
} from "./capabilities.js";

export const SERVER_NAME = "godot-correctness-mcp";

/** Read the package version from the shipped package.json. */
export function readVersion(): string {
  const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version?: string };
  return pkg.version ?? "0.0.0";
}

export interface ServerInfo {
  name: string;
  version: string;
  /** Godot minor versions this server has data for (4.4, 4.5). */
  godotVersions: string[];
  pillars: PillarAvailability;
}

/** Health payload: version, pinned Godot versions, and pillar availability. */
export function getServerInfo(): ServerInfo {
  return {
    name: SERVER_NAME,
    version: readVersion(),
    godotVersions: [...PINNED_GODOT_VERSIONS],
    pillars: pillarAvailability(),
  };
}
