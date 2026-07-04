// configuration-path -- the colon-delimited path helpers (combine /
// getSectionKey / getParentPath). combine has two overloads: a variadic
// string form and a single-Iterable<string> form. A plain string is itself
// iterable (over its characters), so the Iterable-detection guard must
// exclude strings -- otherwise a single variadic string argument is
// mistaken for the Iterable overload and exploded into per-character
// segments.

import { describe, expect, test } from "bun:test";
import { configPath } from "@fnconfig/config";

describe("configPath.combine", () => {
  test("a single variadic string argument is returned as-is, not exploded into characters", () => {
    expect(configPath.combine("Host")).toBe("Host");
  });

  test("multiple variadic string arguments combine in order", () => {
    expect(configPath.combine("a", "b")).toBe("a:b");
  });

  test("a single Iterable<string> argument (e.g. an array) combines its elements", () => {
    expect(configPath.combine(["a", "b"])).toBe("a:b");
  });
});
