// Public entry-point surface for @fnioc/config -- verifies the core symbols a
// consumer (and the provider packages) need are reachable off the barrel, that
// ConfigurationBuilder ships plain add() + build(), that the abstract
// ConfigurationProvider base is subclassable, and that a root builds and binds
// end-to-end through the public entry point alone.

import { describe, expect, test } from "bun:test";
import {
  bindConfig,
  ConfigBindError,
  ConfigurationBuilder,
  ConfigurationKeyComparer,
  ConfigurationProvider,
  ConfigurationRoot,
  ConfigurationSection,
  configPath,
  MemoryConfigurationProvider,
  MemoryConfigurationSource,
} from "@fnioc/config";
import type {
  BindOptions,
  IConfiguration,
  IConfigurationBuilder,
  IConfigurationProvider,
  IConfigurationRoot,
  IConfigurationSection,
  IConfigurationSource,
  Infer,
  ITryGetResult,
  Schema,
  SchemaFor,
} from "@fnioc/config";

describe("public entry point", () => {
  test("exports the core value bindings a consumer and the provider packages need", () => {
    expect(ConfigurationBuilder).toBeDefined();
    expect(ConfigurationRoot).toBeDefined();
    expect(ConfigurationSection).toBeDefined();
    expect(ConfigurationProvider).toBeDefined();
    expect(ConfigurationKeyComparer).toBeDefined();
    expect(MemoryConfigurationSource).toBeDefined();
    expect(MemoryConfigurationProvider).toBeDefined();
    expect(bindConfig).toBeDefined();
    expect(ConfigBindError).toBeDefined();
    expect(configPath).toBeDefined();
    expect(configPath.combine("Server", "Port")).toBe("Server:Port");
    expect(configPath.getSectionKey("Server:Port")).toBe("Port");
  });

  test("ConfigurationBuilder ships ONLY plain add() (returning this) plus build()", () => {
    const builder = new ConfigurationBuilder();
    const returned = builder.add(new MemoryConfigurationSource({ initialData: { "A": "1" } }));

    // add() must return `this` for the augmentation pattern to type-check.
    expect(returned).toBe(builder);
    expect([...builder.sources].length).toBe(1);

    const root = builder.build();
    expect(root).toBeInstanceOf(ConfigurationRoot);
    expect(root.get("A")).toBe("1");
  });

  test("addInMemoryCollection augmentation is installed on the prototype", () => {
    const root = new ConfigurationBuilder()
      .addInMemoryCollection({ "Server:Port": "8080" })
      .build();

    expect(root.get("Server:Port")).toBe("8080");
  });

  test("the abstract ConfigurationProvider base is subclassable by provider packages", () => {
    class FixedProvider extends ConfigurationProvider {
      public override load(): void {
        this.set("Fixed:Key", "value");
      }
    }
    class FixedSource implements IConfigurationSource {
      public build(_builder: IConfigurationBuilder): IConfigurationProvider {
        return new FixedProvider();
      }
    }

    const root = new ConfigurationBuilder().add(new FixedSource()).build();
    // Loaded eagerly at construction, resolved case-insensitively.
    expect(root.get("fixed:key")).toBe("value");
  });

  test("end-to-end: build a root and bind it through the public entry point alone", () => {
    interface Config {
      host: string;
      port: number;
    }

    const schema: SchemaFor<Config> = { host: "string", port: "number" };

    const root = new ConfigurationBuilder()
      .addInMemoryCollection({ "Host": "localhost", "Port": "8080" })
      .build();

    const bound: Config = bindConfig<Config>(root, schema);
    expect(bound).toEqual({ host: "localhost", port: 8080 });
  });

  test("type-only exports are usable in a type position", () => {
    // Compile-time-only assertions -- if any of these types stopped being
    // exported, this file would fail to type-check under `tsc --noEmit`.
    type _Config = IConfiguration;
    type _Root = IConfigurationRoot;
    type _Section = IConfigurationSection;
    type _Provider = IConfigurationProvider;
    type _Builder = IConfigurationBuilder;
    type _Source = IConfigurationSource;
    type _Try = ITryGetResult<string>;
    type _Opts = BindOptions;
    // A concrete, non-recursive schema shape -- `Infer<Schema>` (the fully
    // recursive union `Schema` itself) sends `tsc` into TS2589; this exercises
    // `Infer` in a type position without that runaway recursion.
    type _Inferred = Infer<{ a: "string"; b: { c: "number" } }>;
    const _schema: Schema = "string";
    expect(_schema).toBe("string");
  });
});
