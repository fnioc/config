// Smoke test for the package's public entry point -- verifies every symbol a
// consumer needs (per the README/package description) is actually reachable
// off `../src/index.js`, not just off its owning module.

import { describe, expect, test } from "bun:test";
import {
  bindConfig,
  CommandLineSource,
  ConfigBindError,
  ConfigBuilder,
  ConfigurationRoot,
  EnvironmentVariablesSource,
  JsonFileSource,
} from "../src/index.js";
import type { BindOptions, ConfigSource, Infer, Schema, SchemaFor } from "../src/index.js";

describe("public entry point", () => {
  test("exports the value bindings a consumer needs", () => {
    expect(ConfigBuilder).toBeDefined();
    expect(ConfigurationRoot).toBeDefined();
    expect(bindConfig).toBeDefined();
    expect(ConfigBindError).toBeDefined();
    expect(JsonFileSource).toBeDefined();
    expect(EnvironmentVariablesSource).toBeDefined();
    expect(CommandLineSource).toBeDefined();
  });

  test("end-to-end: build a root and bind it through the public entry point alone", () => {
    interface Config {
      host: string;
      port: number;
    }

    const schema: SchemaFor<Config> = { host: "string", port: "number" };

    const root = new ConfigBuilder()
      .addCommandLine(["--Host=localhost", "--Port=8080"])
      .build();

    // `bindConfig`'s `T` does not infer from a `SchemaFor<T>`-typed second
    // argument under real, strict `tsc` -- pass it explicitly.
    const bound: Config = bindConfig<Config>(root, schema);
    expect(bound).toEqual({ host: "localhost", port: 8080 });
  });

  test("type-only exports are usable in a type position", () => {
    // Compile-time-only assertions -- if any of these types stopped being
    // exported, this file would fail to type-check under `tsc --noEmit`.
    type _Source = ConfigSource;
    type _Opts = BindOptions;
    // A concrete, non-recursive schema shape -- `Infer<Schema>` (the fully
    // recursive union `Schema` type itself, rather than a value of it)
    // sends `tsc` into "Type instantiation is excessively deep and
    // possibly infinite" (TS2589); this still exercises `Infer` in a type
    // position without that runaway recursion.
    type _Inferred = Infer<{ a: "string"; b: { c: "number" } }>;
    const _schema: Schema = "string";
    expect(_schema).toBe("string");
  });
});
