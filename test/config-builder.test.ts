// Behavior tests for ConfigBuilder -- the layering rule is the whole point
// of this design: sources are registered in an order, each flattens its own
// input independently, and ConfigBuilder does a shallow, per-key,
// last-registered-wins merge over the flattened maps (not a deep/structural
// merge of the original nested inputs).

import { afterEach, describe, expect, test } from "bun:test";
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
