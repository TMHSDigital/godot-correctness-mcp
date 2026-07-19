import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { availableVersions, loadSymbolDb } from "../symbols/db.js";
import {
  classSummary,
  diffClass,
  diffSymbol,
  lookupSymbol,
  type SymbolKind,
} from "../symbols/lookup.js";

const VERSION = z.enum(["4.4", "4.5"]);
const KIND = z.enum([
  "class",
  "method",
  "property",
  "signal",
  "enum",
  "constant",
  "builtin_class",
  "builtin_method",
  "utility_function",
  "singleton",
  "global_enum",
]);

type ToolResult = { content: { type: "text"; text: string }[] };

function ok(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function fail(message: string): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify({ error: message }, null, 2) }] };
}

/** Register the API symbol lookup / summary / diff tools. */
export function registerApiTools(server: McpServer): void {
  server.tool(
    "api_symbol_lookup",
    "Look up a Godot API symbol (class, method, property, or signal) by name across " +
      "the pinned Godot versions. Supports 'Owner.member' queries. Returns full " +
      "signature data, or closest-match suggestions on a miss.",
    {
      symbol: z.string().describe("Symbol name, e.g. 'Node', 'move_and_slide', or 'Node.get_child_count'"),
      version: VERSION.optional().describe("Limit to one version; omit to search all available versions"),
      kind: KIND.optional().describe("Restrict results to one symbol kind"),
    },
    async (args) => {
      const { symbol, version, kind } = args as {
        symbol: string;
        version?: "4.4" | "4.5";
        kind?: SymbolKind;
      };
      const versions = version ? [version] : availableVersions();
      if (versions.length === 0) return fail("No symbol databases are available.");
      try {
        const byVersion = Object.fromEntries(
          versions.map((v) => [v, lookupSymbol(loadSymbolDb(v), symbol, kind ? { kind } : {})]),
        );
        return ok({ symbol, versions, results: byVersion });
      } catch (err) {
        return fail(err instanceof Error ? err.message : String(err));
      }
    },
  );

  server.tool(
    "api_class_summary",
    "Full member listing for one Godot class in one version: inheritance chain, " +
      "methods, properties, signals, enums, and constants.",
    {
      class: z.string().describe("Class name, e.g. 'CharacterBody2D'"),
      version: VERSION.describe("Which Godot version to summarize"),
    },
    async (args) => {
      const { class: className, version } = args as { class: string; version: "4.4" | "4.5" };
      try {
        const db = loadSymbolDb(version);
        const summary = classSummary(db, className);
        if (!summary) {
          const suggestions = lookupSymbol(db, className, { kind: "class" }).suggestions ?? [];
          return fail(
            `Class '${className}' not found in Godot ${version}.` +
              (suggestions.length ? ` Did you mean: ${suggestions.map((s) => s.name).join(", ")}?` : ""),
          );
        }
        return ok({ version, ...summary });
      } catch (err) {
        return fail(err instanceof Error ? err.message : String(err));
      }
    },
  );

  server.tool(
    "api_diff",
    "Diff a Godot class or symbol between two versions (default 4.4 -> 4.5): what " +
      "was added, removed, or had its signature changed, with old and new signatures " +
      "side by side.",
    {
      symbol: z.string().describe("Class name (e.g. 'TileMap') or symbol (e.g. 'move_and_slide')"),
      from: VERSION.optional().describe("Base version (default 4.4)"),
      to: VERSION.optional().describe("Target version (default 4.5)"),
    },
    async (args) => {
      const { symbol, from = "4.4", to = "4.5" } = args as {
        symbol: string;
        from?: "4.4" | "4.5";
        to?: "4.5" | "4.4";
      };
      if (from === to) return fail("'from' and 'to' must be different versions.");
      try {
        const fromDb = loadSymbolDb(from);
        const toDb = loadSymbolDb(to);
        // A dotted query is always a member; otherwise try a class diff first.
        if (!symbol.includes(".")) {
          const cd = diffClass(fromDb, toDb, symbol);
          if (cd.presence.inFrom || cd.presence.inTo) return ok({ type: "class", diff: cd });
        }
        return ok({ type: "symbol", diff: diffSymbol(fromDb, toDb, symbol) });
      } catch (err) {
        return fail(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
