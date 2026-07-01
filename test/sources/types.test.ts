// Behavior tests for ConfigurationRoot -- the merged, read-only view over a
// flat colon-delimited key -> string-value map that every later phase
// (sources, ConfigBuilder, schema/bind) is built on top of.

import { describe, expect, test } from "bun:test";
import { ConfigurationRoot } from "../../src/sources/types.js";

describe("ConfigurationRoot.get", () => {
  test("returns the value for an exact key match", () => {
    const root = new ConfigurationRoot(
      new Map([
        ["Server:Port", "8080"],
        ["Server:Host", "localhost"],
      ]),
    );

    expect(root.get("Server:Port")).toBe("8080");
    expect(root.get("Server:Host")).toBe("localhost");
  });

  test("returns undefined for a missing key", () => {
    const root = new ConfigurationRoot(new Map([["Server:Port", "8080"]]));

    expect(root.get("Server:Missing")).toBeUndefined();
  });

  test("does not treat a section prefix as a directly gettable key", () => {
    const root = new ConfigurationRoot(
      new Map([["Database:Primary:Host", "db.internal"]]),
    );

    // "Database:Primary" is a section, not a leaf key -- get() must not
    // match on prefix, only on the full, exact key.
    expect(root.get("Database:Primary")).toBeUndefined();
  });
});

describe("ConfigurationRoot.getSection", () => {
  test("scopes to keys under the prefix and strips the prefix", () => {
    const root = new ConfigurationRoot(
      new Map([
        ["Database:Primary:Host", "db.internal"],
        ["Database:Primary:Port", "5432"],
        ["Database:Secondary:Host", "db2.internal"],
      ]),
    );

    const primary = root.getSection("Database:Primary");

    expect(primary.get("Host")).toBe("db.internal");
    expect(primary.get("Port")).toBe("5432");
    // Sibling section's keys must not leak in.
    expect(primary.get("Secondary:Host")).toBeUndefined();
  });

  test("supports nested getSection calls", () => {
    const root = new ConfigurationRoot(
      new Map([["Database:Primary:Host", "db.internal"]]),
    );

    const database = root.getSection("Database");
    const primary = database.getSection("Primary");

    expect(primary.get("Host")).toBe("db.internal");
  });

  test("a key that exactly equals the prefix (no trailing colon) is excluded", () => {
    const root = new ConfigurationRoot(
      new Map([
        ["Database", "should-not-appear"],
        ["Database:Primary", "db.internal"],
      ]),
    );

    const section = root.getSection("Database");

    expect(section.keys()).toEqual(["Primary"]);
  });

  test("an unmatched prefix returns an empty, but still usable, root", () => {
    const root = new ConfigurationRoot(new Map([["Server:Port", "8080"]]));

    const missing = root.getSection("Nope");

    expect(missing.keys()).toEqual([]);
    expect(missing.get("Anything")).toBeUndefined();
  });
});

describe("ConfigurationRoot.keys", () => {
  test("lists all keys currently in scope", () => {
    const root = new ConfigurationRoot(
      new Map([
        ["Server:Port", "8080"],
        ["Server:Host", "localhost"],
      ]),
    );

    expect([...root.keys()].sort()).toEqual(["Server:Host", "Server:Port"]);
  });

  test("reflects the stripped-prefix view after getSection", () => {
    const root = new ConfigurationRoot(
      new Map([
        ["Database:Primary:Host", "db.internal"],
        ["Database:Primary:Port", "5432"],
      ]),
    );

    const primary = root.getSection("Database:Primary");

    expect([...primary.keys()].sort()).toEqual(["Host", "Port"]);
  });

  test("is empty for a root built from an empty map", () => {
    const root = new ConfigurationRoot(new Map());

    expect(root.keys()).toEqual([]);
  });
});
