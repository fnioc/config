// Behavior tests for EnvironmentVariablesSource -- flattens process.env into
// the ConfigSource contract, filtering by an optional prefix and mapping the
// .NET-style `__` section separator to `:`.

import { afterEach, describe, expect, test } from "bun:test";
import { EnvironmentVariablesSource } from "../../src/sources/environment-variables.js";

const managedKeys = new Set<string>();

function setEnv(name: string, value: string): void {
  process.env[name] = value;
  managedKeys.add(name);
}

afterEach(() => {
  for (const key of managedKeys) {
    delete process.env[key];
  }
  managedKeys.clear();
});

describe("EnvironmentVariablesSource with a prefix", () => {
  test("keeps only vars starting with the prefix and strips it", () => {
    setEnv("FNIOC_TEST_APP_Foo", "1");
    setEnv("FNIOC_TEST_OTHER_Thing", "should-not-appear");

    const result = new EnvironmentVariablesSource("FNIOC_TEST_APP_").load();

    expect(result["Foo"]).toBe("1");
    expect(result["FNIOC_TEST_OTHER_Thing"]).toBeUndefined();
    expect(
      Object.keys(result).some((key) => key.includes("Other")),
    ).toBe(false);
  });

  test("maps double underscore in the remaining name to a colon", () => {
    setEnv("FNIOC_TEST_APP_Server__Port", "8080");

    const result = new EnvironmentVariablesSource("FNIOC_TEST_APP_").load();

    expect(result["Server:Port"]).toBe("8080");
  });

  test("preserves the case of the remaining key as-is", () => {
    setEnv("FNIOC_TEST_APP_myMixedCaseKey", "value");

    const result = new EnvironmentVariablesSource("FNIOC_TEST_APP_").load();

    expect(result["myMixedCaseKey"]).toBe("value");
    expect(result["MYMIXEDCASEKEY"]).toBeUndefined();
  });

  test("passes values through unchanged", () => {
    setEnv("FNIOC_TEST_APP_Count", "0042");

    const result = new EnvironmentVariablesSource("FNIOC_TEST_APP_").load();

    expect(result["Count"]).toBe("0042");
  });
});

describe("EnvironmentVariablesSource without a prefix", () => {
  test("includes all vars, still mapping double underscore to a colon", () => {
    setEnv("FNIOC_TEST_NOPREFIX_Foo", "bar");
    setEnv("FNIOC_TEST_NOPREFIX__Nested__Value", "baz");

    const result = new EnvironmentVariablesSource().load();

    expect(result["FNIOC_TEST_NOPREFIX_Foo"]).toBe("bar");
    expect(result[":Nested:Value"]).toBeUndefined();
    expect(result["FNIOC_TEST_NOPREFIX:Nested:Value"]).toBe("baz");
  });
});
