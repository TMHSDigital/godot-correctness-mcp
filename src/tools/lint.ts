import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { loadConfig } from "../lint/config.js";
import { lintSource } from "../lint/engine.js";
import { lintProject } from "../lint/project.js";

type ToolResult = { content: { type: "text"; text: string }[] };

function ok(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function fail(message: string): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify({ error: message }, null, 2) }] };
}

/** Register the GDScript lint tools (lint_file, lint_project). */
export function registerLintTools(server: McpServer): void {
  server.tool(
    "lint_file",
    "Lint a single GDScript (.gd) file against the default ruleset. Provide either " +
      "inline source or a path on disk. Config is loaded from the file's directory " +
      "if a godot-correctness.config.json is present. Returns a findings array.",
    {
      path: z.string().describe("Path to the .gd file (used for the reported location and config lookup)"),
      source: z.string().optional().describe("Inline GDScript source; if omitted, the file at 'path' is read"),
    },
    async (args) => {
      const { path, source } = args as { path: string; source?: string };
      try {
        const code = source ?? readFileSync(path, "utf-8");
        const config = loadConfig(dirname(path));
        const findings = await lintSource(path, code, config);
        return ok({ file: path, findings, count: findings.length });
      } catch (err) {
        return fail(err instanceof Error ? err.message : String(err));
      }
    },
  );

  server.tool(
    "lint_project",
    "Lint every GDScript file under a project root, honoring include/exclude globs " +
      "from godot-correctness.config.json. Returns aggregated findings and severity counts.",
    {
      path: z.string().describe("Path to the Godot project root"),
    },
    async (args) => {
      const { path } = args as { path: string };
      try {
        return ok(await lintProject(path));
      } catch (err) {
        return fail(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
