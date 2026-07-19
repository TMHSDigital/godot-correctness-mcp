import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { Severity } from "./types.js";

export const CONFIG_FILENAME = "godot-correctness.config.json";

const severitySchema = z.enum(["error", "warning", "info"]);

const ruleConfigSchema = z.object({
  enabled: z.boolean().optional(),
  severity: severitySchema.optional(),
  options: z.record(z.string(), z.unknown()).optional(),
});
export type RuleConfig = z.infer<typeof ruleConfigSchema>;

export const configSchema = z.object({
  /** Globs (relative to project root) of files to lint. */
  include: z.array(z.string()).optional(),
  /** Globs to exclude. */
  exclude: z.array(z.string()).optional(),
  /** Per-rule enable/disable, severity override, and options. */
  rules: z.record(z.string(), ruleConfigSchema).optional(),
  /** Directories of data-driven .tres registries to deep-validate (Phase 4). */
  registryDirs: z.array(z.string()).optional(),
  /** Property-name globs to treat as resource paths (Phase 4). */
  pathPropertyPatterns: z.array(z.string()).optional(),
});
export type GodotCorrectnessConfig = z.infer<typeof configSchema>;

export const DEFAULT_INCLUDE = ["**/*.gd"];
export const DEFAULT_EXCLUDE = ["**/.godot/**"];
export const DEFAULT_PATH_PROPERTY_PATTERNS = ["*_path", "*_scene", "*_texture", "*_resource"];

/** A fully-resolved config with defaults applied. */
export interface ResolvedConfig {
  include: string[];
  exclude: string[];
  rules: Record<string, RuleConfig>;
  registryDirs: string[];
  pathPropertyPatterns: string[];
}

export function resolveConfig(raw: GodotCorrectnessConfig = {}): ResolvedConfig {
  return {
    include: raw.include ?? DEFAULT_INCLUDE,
    exclude: raw.exclude ?? DEFAULT_EXCLUDE,
    rules: raw.rules ?? {},
    registryDirs: raw.registryDirs ?? [],
    pathPropertyPatterns: raw.pathPropertyPatterns ?? DEFAULT_PATH_PROPERTY_PATTERNS,
  };
}

/** Load and validate the config from a project root, or defaults when absent. */
export function loadConfig(projectRoot: string): ResolvedConfig {
  const path = join(projectRoot, CONFIG_FILENAME);
  if (!existsSync(path)) return resolveConfig();
  const raw = JSON.parse(readFileSync(path, "utf-8")) as unknown;
  return resolveConfig(configSchema.parse(raw));
}

/** Whether a rule is enabled (default: enabled unless explicitly disabled). */
export function isRuleEnabled(config: ResolvedConfig, ruleId: string): boolean {
  return config.rules[ruleId]?.enabled !== false;
}

/** Config severity override for a rule, if any. */
export function severityOverride(config: ResolvedConfig, ruleId: string): Severity | undefined {
  return config.rules[ruleId]?.severity;
}

/** Per-rule options from config. */
export function ruleOptions(config: ResolvedConfig, ruleId: string): Record<string, unknown> {
  return config.rules[ruleId]?.options ?? {};
}
