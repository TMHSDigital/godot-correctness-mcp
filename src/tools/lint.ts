import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { lintFile } from "../lint/file.js";
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
    "Lint a single GDScript (.gd) file. Provide inline source or a path on disk; the " +
      "path is always required. Config is loaded from the nearest godot-correctness.config.json " +
      "or project.godot at or above the file's directory, and findings are reported relative " +
      "to that root, matching lint_project. Returns a findings array.",
    {
      path: z.string().describe("Path to the .gd file (config lookup walks up to the nearest project root)"),
      source: z.string().optional().describe("Inline GDScript source; if omitted, the file at 'path' is read"),
    },
    async (args) => {
      const { path, source } = args as { path: string; source?: string };
      try {
        const res = await lintFile(path, source);
        return ok(res);
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
