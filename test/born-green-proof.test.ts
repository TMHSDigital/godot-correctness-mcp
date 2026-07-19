import { describe, expect, it } from "vitest";

// DELIBERATE FAILURE: this test exists only to prove the CI build-and-test gate
// catches a real failing test. It must never be merged to main.
describe("born-green gate proof", () => {
  it("fails on purpose", () => {
    expect(1).toBe(2);
  });
});
