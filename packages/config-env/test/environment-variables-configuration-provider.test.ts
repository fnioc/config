// Behavior tests for EnvironmentVariablesConfigurationProvider -- loads
// `process.env` into the ConfigurationProvider contract, filtering by an
// optional prefix and mapping the conventional `__` section separator to `:`.
//
// Migrated from the pre-rewrite EnvironmentVariablesSource tests
// (test/sources/environment-variables.test.ts), rewritten against the new
// provider shape: assertions go through `tryGet` (case-insensitive store)
// instead of a plain flat object, and the source is built/loaded explicitly
// since load() is no longer implicit construction-time flattening.
//
// Each test injects its own env map through the source's `env` option
// instead of mutating the real `process.env` -- load() is a pure function of
// the source, so there's no shared global state to set up or tear down.

import { describe, expect, test } from "bun:test";
import { ConfigurationBuilder } from "@fnconfig/config";
import "../src/index";
import { EnvironmentVariablesConfigurationSource } from "../src/environment-variables-configuration-source";
import type { EnvironmentVariablesConfigurationSourceOptions } from "../src/environment-variables-configuration-source";
import { EnvironmentVariablesConfigurationProvider } from "../src/environment-variables-configuration-provider";

function providerOf(
  env: Record<string, string | undefined>,
  options?: Omit<EnvironmentVariablesConfigurationSourceOptions, "env">,
) {
  const provider = new EnvironmentVariablesConfigurationProvider(
    new EnvironmentVariablesConfigurationSource({ ...options, env }),
  );
  provider.load();
  return provider;
}

describe("EnvironmentVariablesConfigurationProvider with a prefix", () => {
  test("keeps only vars whose transformed name starts with the prefix and strips it", () => {
    const provider = providerOf(
      { FNIOC_TEST_APP_Foo: "1", FNIOC_TEST_OTHER_Thing: "should-not-appear" },
      { prefix: "FNIOC_TEST_APP_" },
    );

    expect(provider.tryGet("Foo")).toEqual([true, "1"]);
    expect(provider.tryGet("FNIOC_TEST_OTHER_Thing")).toEqual([false]);
    expect([...provider.getChildKeys([], undefined)].some((key) => key.includes("Other"))).toBe(false);
  });

  test("maps double underscore in the remaining name to a colon", () => {
    const provider = providerOf(
      { FNIOC_TEST_APP_Server__Port: "8080" },
      { prefix: "FNIOC_TEST_APP_" },
    );

    expect(provider.tryGet("Server:Port")).toEqual([true, "8080"]);
  });

  test("prefix matching is case-insensitive", () => {
    const provider = providerOf(
      { FNIOC_TEST_APP_Foo: "1" },
      { prefix: "fnioc_test_app_" },
    );

    expect(provider.tryGet("Foo")).toEqual([true, "1"]);
  });

  test("passes values through unchanged", () => {
    const provider = providerOf(
      { FNIOC_TEST_APP_Count: "0042" },
      { prefix: "FNIOC_TEST_APP_" },
    );

    expect(provider.tryGet("Count")).toEqual([true, "0042"]);
  });
});

describe("EnvironmentVariablesConfigurationProvider without a prefix", () => {
  test("includes all vars, still mapping double underscore to a colon", () => {
    const provider = providerOf({
      FNIOC_TEST_NOPREFIX_Foo: "bar",
      FNIOC_TEST_NOPREFIX__Nested__Value: "baz",
    });

    expect(provider.tryGet("FNIOC_TEST_NOPREFIX_Foo")).toEqual([true, "bar"]);
    expect(provider.tryGet(":Nested:Value")).toEqual([false]);
    expect(provider.tryGet("FNIOC_TEST_NOPREFIX:Nested:Value")).toEqual([true, "baz"]);
  });
});

describe("EnvironmentVariablesConfigurationProvider transform-before-filter order", () => {
  // Genuine behavior fix vs. the pre-rewrite EnvironmentVariablesSource, which
  // prefix-matched the RAW variable name before applying the `__` -> `:`
  // transform. A prefix like "FNIOC_TEST_XFORM:Section:" only becomes visible
  // on a raw variable such as `FNIOC_TEST_XFORM__Section__Foo` AFTER the
  // transform runs -- the old code's raw-name filter would never match this,
  // silently dropping the variable. The new provider transforms first, then
  // prefix-matches the transformed name, so this must match.
  test("a var whose prefix only becomes visible after __ -> : translation still matches", () => {
    const provider = providerOf(
      { FNIOC_TEST_XFORM__Section__Foo: "matched" },
      { prefix: "FNIOC_TEST_XFORM:Section:" },
    );

    expect(provider.tryGet("Foo")).toEqual([true, "matched"]);
  });

  test("a custom variableNameTransformation runs before prefix matching too", () => {
    const provider = providerOf(
      { "fnioc-test-custom-app-foo": "custom" },
      {
        prefix: "FNIOC:TEST:CUSTOM:APP:",
        variableNameTransformation: (name) => name.replaceAll("-", ":"),
      },
    );

    expect(provider.tryGet("foo")).toEqual([true, "custom"]);
  });
});

describe("addEnvironmentVariables augmentation", () => {
  test("registers an EnvironmentVariablesConfigurationSource on the builder", () => {
    const config = new ConfigurationBuilder()
      .addEnvironmentVariables({
        prefix: "FNIOC_TEST_BUILDER_APP_",
        env: { FNIOC_TEST_BUILDER_APP_Foo: "via-builder" },
      })
      .build();

    expect(config.get("Foo")).toBe("via-builder");
  });
});
