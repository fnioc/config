// Compile-time regression coverage for SchemaFor<T> -- see src/schema.ts's
// module doc comment for the full claim being tested: a hand-written
// SchemaFor<T> schema literal must fail to compile the moment it drifts
// from T (missing field, extra field, wrong primitive kind, or a bare
// unwrapped optional -- for both top-level and nested-object fields), and a
// schema that matches T exactly must compile with no errors.
//
// This file was previously verified only by hand (a throwaway scratch tsc
// probe, per code review) -- nothing in this repo's own tooling actually
// re-checked the claim on every change. It's `test/*.ts`, so `bun test`
// alone does not type-check it (bun does not type-check anything); what
// makes these `@ts-expect-error` assertions load-bearing is `npm run lint`
// running `tsc -p tsconfig.lint.json`, which (unlike the base
// `tsconfig.json` used by `npm run build`) includes `test/**/*` -- see that
// config's own doc comment. If `SchemaFor<T>` ever silently loosens (or the
// lint config regresses back to `src/**/*` only), one of the
// `@ts-expect-error` comments below stops matching a real error and `tsc`
// fails the build with "Unused '@ts-expect-error' directive".

import { describe, expect, test } from "bun:test";
import type { SchemaFor } from "../src/schema.js";

interface Nested {
  value: string;
}

interface Target {
  host: string;
  port: number;
  enabled: boolean;
  timeout?: number;
  nested: Nested;
}

// A schema that matches Target field-for-field must compile with no errors.
const validSchema: SchemaFor<Target> = {
  host: "string",
  port: "number",
  enabled: "boolean",
  timeout: { optional: "number" },
  nested: { value: "string" },
};

// A field missing from the schema is a compile error.
// @ts-expect-error -- "port" is missing from Target's required fields
const missingField: SchemaFor<Target> = {
  host: "string",
  enabled: "boolean",
  timeout: { optional: "number" },
  nested: { value: "string" },
};

// A field not present on Target is a compile error.
const extraField: SchemaFor<Target> = {
  host: "string",
  port: "number",
  enabled: "boolean",
  timeout: { optional: "number" },
  nested: { value: "string" },
  // @ts-expect-error -- "extra" is not a property of Target
  extra: "string",
};

// The wrong primitive kind for a field is a compile error.
const wrongKind: SchemaFor<Target> = {
  host: "string",
  // @ts-expect-error -- "port" is a number, not a string
  port: "string",
  enabled: "boolean",
  timeout: { optional: "number" },
  nested: { value: "string" },
};

// An optional field that isn't wrapped in `{ optional: ... }` is a compile error.
const unwrappedOptional: SchemaFor<Target> = {
  host: "string",
  port: "number",
  enabled: "boolean",
  // @ts-expect-error -- "timeout" must be `{ optional: "number" }`, not a bare "number"
  timeout: "number",
  nested: { value: "string" },
};

// A nested object schema missing one of its own required fields is a compile error.
const nestedMissingField: SchemaFor<Target> = {
  host: "string",
  port: "number",
  enabled: "boolean",
  timeout: { optional: "number" },
  // @ts-expect-error -- nested.value is missing
  nested: {},
};

// A nested object schema with the wrong primitive kind is a compile error.
const nestedWrongKind: SchemaFor<Target> = {
  host: "string",
  port: "number",
  enabled: "boolean",
  timeout: { optional: "number" },
  // @ts-expect-error -- nested.value is a string, not a number
  nested: { value: "number" },
};

describe("SchemaFor<T>", () => {
  // The assertions above are what this test file actually exists to check
  // (see the module doc comment) -- every `@ts-expect-error` above must
  // land on a genuine compile error, and `validSchema` must compile clean,
  // or `npm run lint` fails. This runtime assertion just keeps `validSchema`
  // (and its now-intentionally-unused `@ts-expect-error` siblings) from
  // being flagged as dead code by anything stricter than `tsc`'s defaults.
  test("a schema literal that matches T field-for-field binds to the expected shape", () => {
    expect(validSchema).toEqual({
      host: "string",
      port: "number",
      enabled: "boolean",
      timeout: { optional: "number" },
      nested: { value: "string" },
    });
    expect([missingField, extraField, wrongKind, unwrappedOptional, nestedMissingField, nestedWrongKind].length).toBe(
      6,
    );
  });
});
