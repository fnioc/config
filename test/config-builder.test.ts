// Behavior tests for ConfigBuilder -- the layering rule is the whole point
// of this design: sources are registered in an order, each flattens its own
// input independently, and ConfigBuilder does a shallow, per-key,
// last-registered-wins merge over the flattened maps (not a deep/structural
// merge of the original nested inputs).

import { afterEach, describe, expect, test } from "bun:test";
import { bindConfig } from "../src/bind.js";
import { ConfigBuilder } from "../src/config-builder.js";

const FIXTURES = "test/fixtures/config-builder";

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

describe("ConfigBuilder.build layering", () => {
  test("a later JSON file overlay overrides specific keys while leaving others untouched", () => {
    const config = new ConfigBuilder()
      .addJsonFile(`${FIXTURES}/base.json`)
      .addJsonFile(`${FIXTURES}/overlay.json`)
      .build();

    // Overridden by the overlay.
    expect(config.get("Server:Port")).toBe("9090");
    // Untouched by the overlay -- still from base.json.
    expect(config.get("Server:Host")).toBe("localhost");
    expect(config.get("Logging:Level")).toBe("Info");
  });

  test("environment variables override JSON", () => {
    setEnv("FNIOC_TEST_BUILDER_Server__Port", "7070");

    const config = new ConfigBuilder()
      .addJsonFile(`${FIXTURES}/base.json`)
      .addJsonFile(`${FIXTURES}/overlay.json`)
      .addEnvironmentVariables("FNIOC_TEST_BUILDER_")
      .build();

    expect(config.get("Server:Port")).toBe("7070");
    // Still untouched -- env source didn't set this key.
    expect(config.get("Server:Host")).toBe("localhost");
  });

  test("a conventionally-uppercase environment variable overrides a differently-cased JSON key", () => {
    // .NET-style usage (and this package's own README/example): env vars are
    // conventionally UPPERCASE while JSON keys retain their natural casing.
    // The merge must be case-folding so the later (env) source truly
    // overwrites the earlier (JSON) one instead of both coexisting.
    setEnv("FNIOC_TEST_BUILDER_SERVER__PORT", "9999");

    const config = new ConfigBuilder()
      .addJsonFile(`${FIXTURES}/server-port-only.json`)
      .addEnvironmentVariables("FNIOC_TEST_BUILDER_")
      .build();

    // Only one casing of the key should survive the merge.
    const portKeys = config.keys().filter((key) => key.toLowerCase() === "server:port");
    expect(portKeys).toHaveLength(1);

    // And bindConfig must see the overridden value, not the JSON one.
    expect(
      bindConfig<{ port: number }>(config, { port: "number" }, { section: "Server" }).port,
    ).toBe(9999);
  });

  test("command line overrides both JSON and environment variables", () => {
    setEnv("FNIOC_TEST_BUILDER_Server__Port", "7070");

    const config = new ConfigBuilder()
      .addJsonFile(`${FIXTURES}/base.json`)
      .addJsonFile(`${FIXTURES}/overlay.json`)
      .addEnvironmentVariables("FNIOC_TEST_BUILDER_")
      .addCommandLine(["--Server:Port", "6060"])
      .build();

    expect(config.get("Server:Port")).toBe("6060");
    expect(config.get("Server:Host")).toBe("localhost");
    expect(config.get("Logging:Level")).toBe("Info");
  });

  test("an optional JSON file that's absent doesn't throw and doesn't affect the merge", () => {
    const config = new ConfigBuilder()
      .addJsonFile(`${FIXTURES}/base.json`)
      .addJsonFile(`${FIXTURES}/does-not-exist.json`, { optional: true })
      .build();

    expect(config.get("Server:Host")).toBe("localhost");
    expect(config.get("Server:Port")).toBe("8080");
    expect(config.get("Logging:Level")).toBe("Info");
  });
});
