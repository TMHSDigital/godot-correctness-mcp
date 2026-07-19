import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { projectReport } from "../scenes/report.js";
import {
  validateProjectConfig,
  validateRegistries,
  validateScenes,
} from "../scenes/validate.js";

type ToolResult = { content: { type: "text"; text: string }[] };

function ok(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}
function fail(message: string): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify({ error: message }, null, 2) }] };
}
function guard(fn: () => unknown): ToolResult {
  try {
    return ok(fn());
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err));
  }
}

/** Register the scene / resource / registry static-analysis tools. */
export function registerSceneTools(server: McpServer): void {
  server.tool(
    "validate_scenes",
    "Validate every .tscn under a project root: ext_resource paths resolve, " +
      "ExtResource references are declared, and there are no duplicate resource ids.",
    { path: z.string().describe("Path to the Godot project root") },
    async (args) => guard(() => {
      const findings = validateScenes((args as { path: string }).path);
      return { findings, count: findings.length };
    }),
  );

  server.tool(
    "validate_project_config",
    "Validate project.godot: the main scene exists, autoload paths exist, and " +
      "input actions are well-formed.",
    { path: z.string().describe("Path to the Godot project root") },
    async (args) => guard(() => {
      const findings = validateProjectConfig((args as { path: string }).path);
      return { findings, count: findings.length };
    }),
  );

  server.tool(
    "validate_registries",
    "Deep-validate data-driven .tres registries in the configured registryDirs: " +
      "each parses, its script resolves (recording class_name), and every " +
      "resource-path property points at an existing file (the dangling-path check).",
    { path: z.string().describe("Path to the Godot project root") },
    async (args) => guard(() => validateRegistries((args as { path: string }).path)),
  );

  server.tool(
    "project_report",
    "Aggregate all static checks (scenes, project config, registries, and " +
      "GDScript lint) into one report with severity counts.",
    { path: z.string().describe("Path to the Godot project root") },
    async (args) => {
      try {
        return ok(await projectReport((args as { path: string }).path));
      } catch (err) {
        return fail(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
