import { readFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer } from "../src/index.js";
import { SKILLS } from "../src/resources/skills.js";

let client: Client;

beforeAll(async () => {
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const server = createServer();
  client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([server.connect(st), client.connect(ct)]);
});

afterAll(async () => {
  await client.close();
});

describe("skill resources (offline, in-memory)", () => {
  it("lists every curated skill", async () => {
    const uris = (await client.listResources()).resources.map((r) => r.uri).sort();
    expect(uris).toEqual(SKILLS.map((s) => `skill://${s.name}`).sort());
  });

  it("reads the data-driven-resources skill and it references the registry tool", async () => {
    const res = await client.readResource({ uri: "skill://data-driven-resources" });
    const text = (res.contents[0] as { text: string }).text;
    expect(text).toContain("validate_registries");
    expect(text).toContain("registryDirs");
  });
});

describe("every skill resource", () => {
  const toolNames = new Set(
    (JSON.parse(readFileSync("mcp-tools.json", "utf-8")) as { name: string }[]).map((t) => t.name),
  );

  it.each(SKILLS.map((s) => s.name))("skill://%s reads as markdown with a heading", async (name) => {
    const res = await client.readResource({ uri: `skill://${name}` });
    const text = (res.contents[0] as { text: string }).text;
    expect(text.trim().length).toBeGreaterThan(100);
    expect(text.trimStart().startsWith("#")).toBe(true);
  });

  it.each(SKILLS.map((s) => s.name))("skill://%s only mentions tools that exist", async (name) => {
    const text = (await client.readResource({ uri: `skill://${name}` })).contents[0] as { text: string };
    const mentioned = [...text.text.matchAll(/`((?:api|lint|validate|project|server|list)_[a-z_]+)`/g)].map((m) => m[1]!);
    for (const tool of mentioned) expect(toolNames, `${name} mentions ${tool}`).toContain(tool);
  });
});

describe("skill cross-links", () => {
  it.each(SKILLS.map((s) => s.name))("skill://%s links only to skills that exist", async (name) => {
    const text = ((await client.readResource({ uri: `skill://${name}` })).contents[0] as { text: string }).text;
    expect(text).not.toMatch(/\[\[[^\]]+\]\]/);
    for (const m of text.matchAll(/\]\(skill:\/\/([a-z0-9-]+)\)/g)) {
      expect(SKILLS.map((s) => s.name)).toContain(m[1]);
    }
  });
});
