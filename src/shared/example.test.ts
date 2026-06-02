import { describe, it, expect } from "vitest";

describe("sample test", () => {
  it("should pass basic arithmetic", () => {
    expect(1 + 1).toBe(2);
  });

  it("should handle string concatenation", () => {
    expect("Hello, " + "World!").toBe("Hello, World!");
  });
});
