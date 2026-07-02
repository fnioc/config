// Layered-source integration, run against the BUILT DIST of every package (see
// moon.yml: these run under `node`, whose import/default export condition
// resolves each `@fnioc/*` bare import to its `dist/index.js` -- the artefact a
// real consumer gets -- whereas `bun`'s implicit "bun" condition would resolve
// to `src`). This exercises the full provider-augmentation surface together:
// addJsonFile / addEnvironmentVariables / addCommandLine, each bolted onto the
// shared ConfigurationBuilder via its own `declare module` + prototype patch.
// If that augmentation didn't survive bundling, these methods wouldn't exist on
// the dist copy of ConfigurationBuilder and every test below would throw.
//
// Behavior note vs. the pre-restructure MVP: the old single-Map engine did an
// eager, case-folding merge, so a test could assert "only one casing of a key
// survives" by scanning `config.keys()`. The faithful-port engine keeps each
// provider's store separate and resolves last-registered-wins lazily per lookup
// (there is no merged key list, and no `keys()`), so the equivalent guarantee
// is asserted directly: a case-insensitive `get`/`bindConfig` returns the
// later source's value rather than the earlier, differently-cased one.

import assert from "node:assert/strict";
import { join } from "node:path";
import { afterEach, describe, test } from "node:test";

import { bindConfig, ConfigurationBuilder } from "@fnioc/config";
// Bare side-effect imports: install addJsonFile / addEnvironmentVariables /
// addCommandLine onto ConfigurationBuilder.prototype from each provider's
// built dist -- the C# `using ...;` equivalent, and the whole point of this
// package's dist-mode run.
import "@fnioc/config-json";
import "@fnioc/config-env";
import "@fnioc/config-commandline";

const FIXTURES = join(import.meta.dirname, "fixtures", "config-builder");

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

describe("layering: addJsonFile / addEnvironmentVariables / addCommandLine (built dist)", () => {
  test("a later JSON file overlay overrides specific keys while leaving others untouched", () => {
    const config = new ConfigurationBuilder()
      .addJsonFile(`${FIXTURES}/base.json`)
      .addJsonFile(`${FIXTURES}/overlay.json`)
      .build();

    // Overridden by the overlay.
    assert.equal(config.get("Server:Port"), "9090");
    // Untouched by the overlay -- still from base.json.
    assert.equal(config.get("Server:Host"), "localhost");
    assert.equal(config.get("Logging:Level"), "Info");
  });

  test("environment variables override JSON", () => {
    setEnv("FNIOC_TEST_BUILDER_Server__Port", "7070");

    const config = new ConfigurationBuilder()
      .addJsonFile(`${FIXTURES}/base.json`)
      .addJsonFile(`${FIXTURES}/overlay.json`)
      .addEnvironmentVariables({ prefix: "FNIOC_TEST_BUILDER_" })
      .build();

    assert.equal(config.get("Server:Port"), "7070");
    // Still untouched -- env source didn't set this key.
    assert.equal(config.get("Server:Host"), "localhost");
  });

  test("a conventionally-uppercase env var overrides a JSON key across a layered (base+overlay) merge", () => {
    // Broadens #5's single-JSON-file regression to the layered stack: base.json
    // sets Server:Port, overlay.json rewrites it (still natural-cased), then an
    // UPPERCASE env var must still override the JSON key rather than coexisting
    // with it. The env source's transformed key is `SERVER:PORT`; the
    // provider store folds case, so a `Server:Port` lookup checked against the
    // last-registered (env) provider first must return the env value.
    setEnv("FNIOC_TEST_BUILDER_SERVER__PORT", "7070");

    const config = new ConfigurationBuilder()
      .addJsonFile(`${FIXTURES}/base.json`)
      .addJsonFile(`${FIXTURES}/overlay.json`)
      .addEnvironmentVariables({ prefix: "FNIOC_TEST_BUILDER_" })
      .build();

    // The env value wins over the (differently-cased) merged JSON value,
    // resolved case-insensitively -- both directly and through a section bind.
    assert.equal(config.get("Server:Port"), "7070");
    assert.equal(
      bindConfig<{ port: number }>(config, { port: "number" }, { section: "Server" }).port,
      7070,
    );

    // A key the env source didn't touch still resolves from JSON.
    assert.equal(config.get("Server:Host"), "localhost");
  });

  test("a conventionally-uppercase environment variable overrides a differently-cased JSON key", () => {
    // .NET-style usage (and this package's own README/example): env vars are
    // conventionally UPPERCASE while JSON keys retain their natural casing.
    // The case-folding provider store must make the later (env) source win over
    // the earlier (JSON) one instead of both coexisting behind two casings.
    setEnv("FNIOC_TEST_BUILDER_SERVER__PORT", "9999");

    const config = new ConfigurationBuilder()
      .addJsonFile(`${FIXTURES}/server-port-only.json`)
      .addEnvironmentVariables({ prefix: "FNIOC_TEST_BUILDER_" })
      .build();

    assert.equal(config.get("Server:Port"), "9999");
    assert.equal(
      bindConfig<{ port: number }>(config, { port: "number" }, { section: "Server" }).port,
      9999,
    );
  });

  test("command line overrides both JSON and environment variables", () => {
    setEnv("FNIOC_TEST_BUILDER_Server__Port", "7070");

    const config = new ConfigurationBuilder()
      .addJsonFile(`${FIXTURES}/base.json`)
      .addJsonFile(`${FIXTURES}/overlay.json`)
      .addEnvironmentVariables({ prefix: "FNIOC_TEST_BUILDER_" })
      .addCommandLine(["--Server:Port", "6060"])
      .build();

    assert.equal(config.get("Server:Port"), "6060");
    assert.equal(config.get("Server:Host"), "localhost");
    assert.equal(config.get("Logging:Level"), "Info");
  });

  test("an optional JSON file that's absent doesn't throw and doesn't affect the merge", () => {
    const config = new ConfigurationBuilder()
      .addJsonFile(`${FIXTURES}/base.json`)
      .addJsonFile(`${FIXTURES}/does-not-exist.json`, { optional: true })
      .build();

    assert.equal(config.get("Server:Host"), "localhost");
    assert.equal(config.get("Server:Port"), "8080");
    assert.equal(config.get("Logging:Level"), "Info");
  });
});
