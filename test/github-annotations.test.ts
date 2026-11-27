import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runCli } from "../src/cli.js";
import { toGithubAnnotations } from "../src/github-annotations.js";
import type { Finding } from "../src/lint/types.js";

const fixture = (rel: string): string => fileURLToPath(new URL(`./fixtures/${rel}`, import.meta.url));

describe("toGithubAnnotations", () => {
  const f = (over: Partial<Finding>): Finding => ({
    file: "scripts/a.gd", line: 3, col: 5, ruleId: "untyped-declaration", severity: "warning", message: "M.", suggestion: "", ...over,
  });

  it("maps severities to workflow commands and re-bases paths onto cwd", () => {
    const out = toGithubAnnotations(
      [f({ severity: "error", line: 1 }), f({ severity: "warning", line: 2, suggestion: "S." }), f({ severity: "info", line: 3 })],
      { projectRoot: join("/repo", "game"), cwd: "/repo" },
    );
    expect(out.split("\n")).toEqual([
      "::error file=game/scripts/a.gd,line=1,col=5,title=untyped-declaration::M.",
      "::warning file=game/scripts/a.gd,line=2,col=5,title=untyped-declaration::M. S.",
      "::notice file=game/scripts/a.gd,line=3,col=5,title=untyped-declaration::M.",
    ]);
  });

  it("escapes %, CR and LF in messages, and also , and : in properties", () => {
    const out = toGithubAnnotations([f({ file: "a,b:c%.gd", message: "50% done\r\nnext" })], { projectRoot: "/r", cwd: "/r" });
    expect(out).toBe("::warning file=a%2Cb%3Ac%25.gd,line=3,col=5,title=untyped-declaration::50%25 done%0D%0Anext");
    expect(out.split("\n")).toHaveLength(1);
  });

  it("prints nothing for no findings", () => {
    expect(toGithubAnnotations([], { projectRoot: "/r" })).toBe("");
  });
});

describe("gdcorrect --format github", () => {
  it("prints annotations and keeps the exit-code contract", async () => {
    let out = "";
    const code = await runCli(["lint", fixture("lint-project"), "--format", "github"], (s) => (out += s), () => {});
    expect(code).toBe(1);
    const lines = out.split("\n").filter(Boolean);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((l) => /^::(error|warning|notice) file=[^,]+,line=\d+,col=\d+,title=[a-z-]+::/.test(l))).toBe(true);
    expect(lines.some((l) => l.startsWith("::error "))).toBe(true);
  });
});
