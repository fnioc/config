// Behavior tests for bindConfig -- walks a SchemaFor<T> against a
// ConfigurationRoot's flat, case-insensitively-matched keys and produces a
// typed T, or aggregates every binding failure into a single thrown
// ConfigBindError.

import { describe, expect, test } from "bun:test";
import { bindConfig, ConfigBindError } from "../src/bind.js";
import type { SchemaFor } from "../src/schema.js";
import { ConfigurationRoot } from "../src/sources/types.js";

interface ServerConfig {
  host: string;
  port: number;
  enabled: boolean;
  timeout?: number;
  nested: {
    value: string;
  };
}

const serverSchema: SchemaFor<ServerConfig> = {
  host: "string",
  port: "number",
  enabled: "boolean",
  timeout: { optional: "number" },
  nested: {
    value: "string",
  },
};

describe("bindConfig", () => {
  test("binds a fully-valid flat config into a typed object", () => {
    const root = new ConfigurationRoot(
      new Map([
        ["Host", "localhost"],
        ["Port", "8080"],
        ["Enabled", "true"],
        ["Nested:Value", "hello"],
      ]),
    );

    // `bindConfig`'s `T` does not infer from a `SchemaFor<T>`-typed second
    // argument under real, strict `tsc` -- see examples/without-transformer's
    // main.ts for the full writeup -- so every call site here passes it
    // explicitly (also what surfaces this file actually being type-checked;
    // see tsconfig.lint.json).
    const result = bindConfig<ServerConfig>(root, serverSchema);

    expect(result).toEqual({
      host: "localhost",
      port: 8080,
      enabled: true,
      timeout: undefined,
      nested: { value: "hello" },
    });
  });

  test("a missing required key throws ConfigBindError naming the key", () => {
    const root = new ConfigurationRoot(
      new Map([
        ["Port", "8080"],
        ["Enabled", "true"],
        ["Nested:Value", "hello"],
      ]),
    );

    expect(() => bindConfig<ServerConfig>(root, serverSchema)).toThrow(ConfigBindError);

    try {
      bindConfig<ServerConfig>(root, serverSchema);
      throw new Error("expected bindConfig to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigBindError);
      const bindErr = err as ConfigBindError;
      expect(bindErr.issues.length).toBe(1);
      expect(bindErr.issues[0]).toContain("host");
      expect(bindErr.message).toContain("host");
    }
  });

  test("a non-numeric raw value for a number field is recorded as an issue", () => {
    const root = new ConfigurationRoot(
      new Map([
        ["Host", "localhost"],
        ["Port", "not-a-number"],
        ["Enabled", "true"],
        ["Nested:Value", "hello"],
      ]),
    );

    try {
      bindConfig<ServerConfig>(root, serverSchema);
      throw new Error("expected bindConfig to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigBindError);
      const bindErr = err as ConfigBindError;
      expect(bindErr.issues.length).toBe(1);
      expect(bindErr.issues[0]).toContain("port");
      expect(bindErr.issues[0]).toContain("not-a-number");
    }
  });

  test("an empty or whitespace-only raw value for a number field is recorded as an issue, not coerced to 0", () => {
    // Regression test: `Number("")` and `Number("   ")` both evaluate to
    // `0`, not `NaN` -- so a naive `Number(raw)` coercion silently turns an
    // empty env var (`APP_Port=`) or CLI arg (`--Port=`) into a valid-
    // looking zero instead of an aggregated ConfigBindError issue.
    const root = new ConfigurationRoot(
      new Map([
        ["Host", "localhost"],
        ["Port", ""],
        ["Enabled", "true"],
        ["Nested:Value", "hello"],
      ]),
    );

    try {
      bindConfig<ServerConfig>(root, serverSchema);
      throw new Error("expected bindConfig to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigBindError);
      const bindErr = err as ConfigBindError;
      expect(bindErr.issues.length).toBe(1);
      expect(bindErr.issues[0]).toContain("port");
    }
  });

  test("a non-finite numeric raw value (Infinity/-Infinity/overflow) is rejected, not coerced", () => {
    // `Number("Infinity")`, `Number("-Infinity")`, and an overflowing literal
    // like `Number("1e400")` all evaluate to a non-NaN but non-finite value.
    // A `!Number.isNaN(n)` validity guard would wave them straight through as
    // valid numbers -- but a port (or any config number) of Infinity is never
    // what the operator meant. They must land on the same invalid-number path
    // as any other unparseable value.
    for (const bad of ["Infinity", "-Infinity", "1e400"]) {
      const root = new ConfigurationRoot(
        new Map([
          ["Host", "localhost"],
          ["Port", bad],
          ["Enabled", "true"],
          ["Nested:Value", "hello"],
        ]),
      );

      try {
        bindConfig<ServerConfig>(root, serverSchema);
        throw new Error(`expected bindConfig to throw for Port="${bad}"`);
      } catch (err) {
        expect(err).toBeInstanceOf(ConfigBindError);
        const bindErr = err as ConfigBindError;
        expect(bindErr.issues.length).toBe(1);
        expect(bindErr.issues[0]).toContain("port");
        expect(bindErr.issues[0]).toContain(bad);
      }
    }
  });

  test("an unrecognized raw value for a boolean field is recorded as an issue", () => {
    const root = new ConfigurationRoot(
      new Map([
        ["Host", "localhost"],
        ["Port", "8080"],
        ["Enabled", "yes"],
        ["Nested:Value", "hello"],
      ]),
    );

    try {
      bindConfig<ServerConfig>(root, serverSchema);
      throw new Error("expected bindConfig to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigBindError);
      const bindErr = err as ConfigBindError;
      expect(bindErr.issues.length).toBe(1);
      expect(bindErr.issues[0]).toContain("enabled");
      expect(bindErr.issues[0]).toContain("yes");
    }
  });

  test("an absent optional field binds to undefined without raising an issue", () => {
    const root = new ConfigurationRoot(
      new Map([
        ["Host", "localhost"],
        ["Port", "8080"],
        ["Enabled", "true"],
        ["Nested:Value", "hello"],
      ]),
    );

    const result = bindConfig<ServerConfig>(root, serverSchema);

    expect(result.timeout).toBeUndefined();
  });

  test("a present optional field binds to its coerced value", () => {
    const root = new ConfigurationRoot(
      new Map([
        ["Host", "localhost"],
        ["Port", "8080"],
        ["Enabled", "true"],
        ["Timeout", "30"],
        ["Nested:Value", "hello"],
      ]),
    );

    const result = bindConfig<ServerConfig>(root, serverSchema);

    expect(result.timeout).toBe(30);
  });

  test("key matching is case-insensitive against schema property names", () => {
    const root = new ConfigurationRoot(
      new Map([
        ["HOST", "localhost"],
        ["pOrT", "8080"],
        ["enabled", "true"],
        ["NESTED:VALUE", "hello"],
      ]),
    );

    const result = bindConfig<ServerConfig>(root, serverSchema);

    expect(result).toEqual({
      host: "localhost",
      port: 8080,
      enabled: true,
      timeout: undefined,
      nested: { value: "hello" },
    });
  });

  test("opts.section narrows the root before binding", () => {
    interface DbConfig {
      host: string;
      port: number;
    }

    const dbSchema: SchemaFor<DbConfig> = {
      host: "string",
      port: "number",
    };

    const root = new ConfigurationRoot(
      new Map([
        ["Database:Host", "db.internal"],
        ["Database:Port", "5432"],
        ["Other:Thing", "irrelevant"],
      ]),
    );

    const result = bindConfig<DbConfig>(root, dbSchema, { section: "Database" });

    expect(result).toEqual({ host: "db.internal", port: 5432 });
  });

  test("opts.section matches case-insensitively, like every other key/section lookup", () => {
    // Regression test: bindConfig's own doc comment (and every other
    // key/section match in this binder) documents case-insensitive
    // matching, .NET-binder-style -- but opts.section used to call
    // root.getSection(opts.section) directly, which is a raw, case-
    // sensitive prefix match. A caller narrowing to "database" against
    // keys stored as "Database:Host"/"Database:Port" would silently get
    // an empty scope and every field reported as a missing-key issue.
    interface DbConfig {
      host: string;
      port: number;
    }

    const dbSchema: SchemaFor<DbConfig> = {
      host: "string",
      port: "number",
    };

    const root = new ConfigurationRoot(
      new Map([
        ["Database:Host", "db.internal"],
        ["Database:Port", "5432"],
      ]),
    );

    const result = bindConfig<DbConfig>(root, dbSchema, { section: "database" });

    expect(result).toEqual({ host: "db.internal", port: 5432 });
  });

  test("aggregates multiple simultaneous failures into one thrown error with multiple issues", () => {
    // Missing required "host", bad number for "port", bad boolean for
    // "enabled" -- all in a single bind call. A fail-fast implementation
    // that throws on the first problem it finds would only ever report one
    // of these; this test requires all three to show up in the same
    // ConfigBindError's .issues array, proving failures aggregate instead.
    const root = new ConfigurationRoot(
      new Map([
        ["Port", "not-a-number"],
        ["Enabled", "nope"],
        ["Nested:Value", "hello"],
      ]),
    );

    try {
      bindConfig<ServerConfig>(root, serverSchema);
      throw new Error("expected bindConfig to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigBindError);
      const bindErr = err as ConfigBindError;
      expect(bindErr.issues.length).toBeGreaterThan(1);
      expect(bindErr.issues.length).toBe(3);
      expect(bindErr.issues.some((issue) => issue.includes("host"))).toBe(true);
      expect(bindErr.issues.some((issue) => issue.includes("port"))).toBe(true);
      expect(bindErr.issues.some((issue) => issue.includes("enabled"))).toBe(true);
    }
  });
});
