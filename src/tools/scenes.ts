import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { projectReport, reportFindings, validateSceneFiles } from "../scenes/report.js";
import { validateProjectConfig, validateRegistries } from "../scenes/validate.js";
import { requireDir } from "../project/walk.js";
import { findingsPayload, payloadWithBaseline, registriesPayload } from "../baseline-payload.js";
import { guard } from "./result.js";

export const BASELINE_ARG = z
  .string()
  .min(1)
  .optional()
  .describe(
    "Optional gdcorrect baseline file (from 'gdcorrect <cmd> --write-baseline'); relative paths resolve " +
      "against the project root. When set, only findings not in the baseline are returned, plus " +
      "'baselined' and 'staleBaselineEntries' counts.",
  );

const ROOT_ARG = {
  path: z.string().min(1).describe("Path to the Godot project root"),
  baseline: BASELINE_ARG,
};

const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;

/** Register the scene / resource / registry static-analysis tools. */
export function registerSceneTools(server: McpServer): void {
  server.registerTool(
    "validate_scenes",
    {
      description:
        "Validate every .tscn under a project root: ext_resource paths resolve, " +
        "ExtResource/SubResource references are declared, there are no duplicate resource " +
        "ids, node parent paths exist, [connection] targets have the named method, and " +
        "literal $Path/get_node() paths in attached scripts exist in the scene.",
      inputSchema: ROOT_ARG,
      annotations: READ_ONLY,
    },
    async ({ path, baseline }) =>
      guard(async () => {
        requireDir(path);
        const findings = await validateSceneFiles(path);
        return payloadWithBaseline(path, findingsPayload(path, findings), findings, baseline);
      }),
  );

  server.registerTool(
    "validate_project_config",
    {
      description:
        "Validate project.godot: the main scene exists, autoload paths exist, input " +
        "actions are well-formed, and input action names used in scripts are defined.",
      inputSchema: ROOT_ARG,
      annotations: READ_ONLY,
    },
    async ({ path, baseline }) =>
      guard(() => {
        requireDir(path);
        const findings = validateProjectConfig(path);
        return payloadWithBaseline(path, findingsPayload(path, findings), findings, baseline);
      }),
  );

  server.registerTool(
    "validate_registries",
    {
      description:
        "Deep-validate data-driven .tres registries in the configured registryDirs: " +
        "each parses, its script resolves (recording class_name), and every " +
        "resource-path property points at an existing file (the dangling-path check).",
      inputSchema: ROOT_ARG,
      annotations: READ_ONLY,
    },
    async ({ path, baseline }) =>
      guard(() => {
        requireDir(path);
        const r = validateRegistries(path);
        return payloadWithBaseline(path, registriesPayload(path, r), r.findings, baseline);
      }),
  );

  server.registerTool(
    "project_report",
    {
      description:
        "Aggregate all static checks (scenes, project config, registries, and " +
        "GDScript lint) into one report with severity counts.",
      inputSchema: ROOT_ARG,
      annotations: READ_ONLY,
    },
    async ({ path, baseline }) =>
      guard(async () => {
        requireDir(path);
        const r = await projectReport(path);
        return payloadWithBaseline(path, { kind: "report", payload: r }, reportFindings(r), baseline);
      }),
  );
}
