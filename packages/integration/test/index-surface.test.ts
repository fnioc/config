// Public-surface smoke test for the pieces that only exist ACROSS the package
// split -- run against the BUILT DIST (node resolves each @fnioc/* import to
// dist/index.js; see moon.yml). packages/config's own index.test.ts already
// covers the core barrel (ConfigurationBuilder/Root/Section/Provider,
// bindConfig, the Memory provider, the abstractions, and addInMemoryCollection)
// in source mode; this file covers what that one structurally cannot:
//
//   1. each provider package exports its Source/Provider runtime symbols, and
//   2. the three external-provider add* augmentations are actually installed on
//      the SAME ConfigurationBuilder the consumer imports -- i.e. they survived
//      each provider being bundled with `@fnconfig/config` kept external, and the
//      `declare module` survived rollup-plugin-dts. This is the regression the
//      whole integration package exists to catch.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { bindConfig, ConfigurationBuilder } from "@fnconfig/config";
import type { SchemaFor } from "@fnconfig/config";
import { CommandLineConfigurationProvider, CommandLineConfigurationSource } from "@fnconfig/commandline";
import type { CommandLineConfigurationSourceOptions } from "@fnconfig/commandline";
import {
  defaultVariableNameTransformation,
  EnvironmentVariablesConfigurationProvider,
  EnvironmentVariablesConfigurationSource,
} from "@fnconfig/env";
import type { EnvironmentVariablesConfigurationSourceOptions } from "@fnconfig/env";
import { JsonConfigurationProvider, JsonConfigurationSource } from "@fnconfig/json";
import type { JsonConfigurationSourceOptions } from "@fnconfig/json";

describe("cross-package public surface (built dist)", () => {
  test("each provider package exports its Source and Provider runtime bindings", () => {
    assert.equal(typeof JsonConfigurationSource, "function");
    assert.equal(typeof JsonConfigurationProvider, "function");
    assert.equal(typeof EnvironmentVariablesConfigurationSource, "function");
    assert.equal(typeof EnvironmentVariablesConfigurationProvider, "function");
    assert.equal(typeof defaultVariableNameTransformation, "function");
    assert.equal(typeof CommandLineConfigurationSource, "function");
    assert.equal(typeof CommandLineConfigurationProvider, "function");
  });

  test("the add* augmentations are installed on ConfigurationBuilder's prototype", () => {
    const builder = new ConfigurationBuilder();
    // These exist ONLY if each provider's prototype patch survived bundling
    // against the same (external) @fnconfig/config class this test imports.
    assert.equal(typeof builder.addJsonFile, "function");
    assert.equal(typeof builder.addEnvironmentVariables, "function");
    assert.equal(typeof builder.addCommandLine, "function");
  });

  test("a root builds and binds through all three provider entry points together", () => {
    interface Config {
      host: string;
      port: number;
    }

    const schema: SchemaFor<Config> = { host: "string", port: "number" };

    // Only the command-line augmentation contributes data here; the point is
    // that the fluent chain type-checks and runs with all three providers'
    // declaration merges in the program at once (the multi-augmenter case that
    // motivated the `@fnconfig/config/configuration-builder` subpath).
    const root = new ConfigurationBuilder()
      .addCommandLine(["--Host=localhost", "--Port=8080"])
      .build();

    const bound: Config = bindConfig<Config>(root, schema);
    assert.deepEqual(bound, { host: "localhost", port: 8080 });
  });

  test("provider option types are usable in a type position", () => {
    // Compile-time-only -- if any of these stopped being exported, the lint
    // task (`tsc --noEmit`) would fail here.
    type _Json = JsonConfigurationSourceOptions;
    type _Env = EnvironmentVariablesConfigurationSourceOptions;
    type _Cli = CommandLineConfigurationSourceOptions;
    const _optional: _Json = { optional: true };
    const _prefix: _Env = { prefix: "APP_" };
    const _mappings: _Cli = { switchMappings: { "-h": "Host" } };
    assert.equal(_optional.optional, true);
    assert.equal(_prefix.prefix, "APP_");
    assert.deepEqual(_mappings.switchMappings, { "-h": "Host" });
  });
});
