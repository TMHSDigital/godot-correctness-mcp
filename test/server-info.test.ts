import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { createServer } from "../src/index.js";
import { getServerInfo, SERVER_NAME } from "../src/server-info.js";

describe("getServerInfo", () => {
  it("reports name, pinned Godot versions, and a semver version", () => {
    const info = getServerInfo();
    expect(info.name).toBe(SERVER_NAME);
    expect(info.godotVersions).toEqual(["4.4", "4.5"]);
    expect(info.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("reports pillar availability derived from committed artifacts", () => {
    // Phase 2 ships the symbol DBs, so apiSymbols is available; the grammar
    // WASM (Phase 3) and scene analyzer (Phase 4) are not yet present.
    expect(getServerInfo().pillars).toEqual({
      gdscriptLint: false,
      apiSymbols: true,
      sceneResourceAnalysis: false,
    });
  });
});

describe("server_info tool (offline, in-memory transport)", () => {
  it("is registered and returns the health payload", async () => {
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const server = createServer();
    const client = new Client({ name: "test-client", version: "0.0.0" });

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    try {
      const listed = await client.listTools();
      expect(listed.tools.map((t) => t.name)).toContain("server_info");

      const result = await client.callTool({ name: "server_info", arguments: {} });
      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0]?.type).toBe("text");
      const payload = JSON.parse(content[0]!.text) as ReturnType<typeof getServerInfo>;
      expect(payload).toEqual(getServerInfo());
    } finally {
      await client.close();
      await server.close();
    }
  });
});
