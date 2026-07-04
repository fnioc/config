// Behavior tests for bindConfig -- walks a SchemaFor<T> against an
// IConfiguration's case-insensitively-matched keys and produces a typed T, or
// aggregates every binding failure into a single thrown ConfigBindError.
//
// Migrated from the pre-rewrite test/bind.test.ts. The binder's observable
// contract (aggregate errors, required/optional distinction, number/boolean
// coercion, case-insensitive matching, section narrowing) is UNCHANGED -- what
// changed underneath is that bindConfig now walks IConfiguration rather than
// scanning a ConfigurationRoot's raw key list, so the roots here are built via
// the real ConfigurationBuilder/Memory-provider path (rootOf) instead of
// `new ConfigurationRoot(new Map(...))`.

import { describe, expect, test } from "bun:test";
import { bindConfig, ConfigBindError, optional } from "@fnconfig/config";
import type { SchemaFor } from "@fnconfig/config";
import { rootOf } from "./support";

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
  timeout: optional("number"),
  nested: {
    value: "string",
  },
};

describe("bindConfig", () => {
  test("binds a fully-valid flat config into a typed object", () => {
    const root = rootOf({
      "Host": "localhost",
      "Port": "8080",
      "Enabled": "true",
      "Nested:Value": "hello",
    });

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
    const root = rootOf({
      "Port": "8080",
      "Enabled": "true",
      "Nested:Value": "hello",
    });

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
    const root = rootOf({
      "Host": "localhost",
      "Port": "not-a-number",
      "Enabled": "true",
      "Nested:Value": "hello",
    });

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
    const root = rootOf({
      "Host": "localhost",
      "Port": "",
      "Enabled": "true",
      "Nested:Value": "hello",
    });

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
    for (const bad of ["Infinity", "-Infinity", "1e400"]) {
      const root = rootOf({
        "Host": "localhost",
        "Port": bad,
        "Enabled": "true",
        "Nested:Value": "hello",
      });

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
    const root = rootOf({
      "Host": "localhost",
      "Port": "8080",
      "Enabled": "yes",
      "Nested:Value": "hello",
    });

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
    const root = rootOf({
      "Host": "localhost",
      "Port": "8080",
      "Enabled": "true",
      "Nested:Value": "hello",
    });

    const result = bindConfig<ServerConfig>(root, serverSchema);
    expect(result.timeout).toBeUndefined();
  });

  test("a present optional field binds to its coerced value", () => {
    const root = rootOf({
      "Host": "localhost",
      "Port": "8080",
      "Enabled": "true",
      "Timeout": "30",
      "Nested:Value": "hello",
    });

    const result = bindConfig<ServerConfig>(root, serverSchema);
    expect(result.timeout).toBe(30);
  });

  test("a real nested property literally named `optional` is not mistaken for the optional-field wrapper", () => {
    // Regression: the optional-field wrapper used to be detected by the key
    // NAME "optional", so a genuine object property called `optional` bound
    // as if the whole object were an absent optional field -- yielding
    // `{ feature: undefined }` instead of `{ feature: { optional: <value> } }`.
    interface Feature {
      optional: string;
    }
    interface AppConfig {
      feature: Feature;
    }

    const schema: SchemaFor<AppConfig> = { feature: { optional: "string" } };

    const root = rootOf({
      "Feature:Optional": "present",
    });

    const result = bindConfig<AppConfig>(root, schema);
    expect(result).toEqual({ feature: { optional: "present" } });
  });

  test("a genuinely optional field and a real property named `optional` coexist", () => {
    // The `optional(...)` wrapper (symbol-keyed) marks `timeout` as optional,
    // while `optional` is an ordinary required string field. The two are
    // distinguished out-of-band, so both bind to their own values.
    interface Mixed {
      optional: string;
      timeout?: number;
    }

    const schema: SchemaFor<Mixed> = {
      optional: "string",
      timeout: optional("number"),
    };

    const root = rootOf({ "Optional": "literal" });

    const result = bindConfig<Mixed>(root, schema);
    expect(result).toEqual({ optional: "literal", timeout: undefined });
  });

  test("key matching is case-insensitive against schema property names", () => {
    const root = rootOf({
      "HOST": "localhost",
      "pOrT": "8080",
      "enabled": "true",
      "NESTED:VALUE": "hello",
    });

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

    const dbSchema: SchemaFor<DbConfig> = { host: "string", port: "number" };

    const root = rootOf({
      "Database:Host": "db.internal",
      "Database:Port": "5432",
      "Other:Thing": "irrelevant",
    });

    const result = bindConfig<DbConfig>(root, dbSchema, { section: "Database" });
    expect(result).toEqual({ host: "db.internal", port: 5432 });
  });

  test("opts.section matches case-insensitively, like every other key/section lookup", () => {
    interface DbConfig {
      host: string;
      port: number;
    }

    const dbSchema: SchemaFor<DbConfig> = { host: "string", port: "number" };

    const root = rootOf({
      "Database:Host": "db.internal",
      "Database:Port": "5432",
    });

    const result = bindConfig<DbConfig>(root, dbSchema, { section: "database" });
    expect(result).toEqual({ host: "db.internal", port: 5432 });
  });

  test("aggregates multiple simultaneous failures into one thrown error with multiple issues", () => {
    const root = rootOf({
      "Port": "not-a-number",
      "Enabled": "nope",
      "Nested:Value": "hello",
    });

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
