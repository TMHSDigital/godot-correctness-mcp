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
