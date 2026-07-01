// End-to-end integration test: ConfigBuilder -> bindConfig -> DI resolution,
// wired through the REAL, published `@fnioc/di` package (the same dependency
// version -- ^1.0.0 -- this package itself depends on), reusing the exact
// `ApiServer` / `DatabasePool` classes and `appsettings*.json` fixtures the
// runnable example at examples/without-transformer ships. This is the test
// that proves the whole MVP pipeline actually works TOGETHER -- every other
// test file in this suite only proves one piece (a source, ConfigBuilder's
// merge, or bindConfig's walk) in isolation.

import { afterEach, describe, expect, test } from "bun:test";
import { DiBuilder, forCtor } from "@fnioc/di";

import { bindConfig, ConfigBuilder } from "../src/index.js";
import type { SchemaFor } from "../src/index.js";
import type { DatabaseConfig, ServerConfig } from "../examples/without-transformer/src/contracts.js";
import { ApiServer, DatabasePool } from "../examples/without-transformer/src/services.js";

const EXAMPLE_DIR = "examples/without-transformer";

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

// Hand-written schemas, checked against SchemaFor<T> exactly as the example
// does -- see examples/without-transformer/src/main.ts for the full writeup
// on why `bindConfig` needs an explicit `<T>` here (its `T` does not infer
// from a `SchemaFor<T>`-typed argument under real, strict `tsc`).
const SERVER_CONFIG_SCHEMA: SchemaFor<ServerConfig> = {
  host: "string",
  port: "number",
  ssl: { optional: "boolean" },
};

const DATABASE_CONFIG_SCHEMA: SchemaFor<DatabaseConfig> = {
  host: "string",
  database: "string",
  poolSize: "number",
};

describe("end-to-end: ConfigBuilder -> bindConfig -> DI resolution", () => {
  test("resolves a constructor-injected ApiServer and two section-bound DatabaseConfig instances", () => {
    // Same layering the example demonstrates: JSON base <- JSON dev overlay
    // <- env vars (APP_ prefix) <- CLI args, last-registered-wins per key.
    // The env name is deliberately conventional UPPERCASE (APP_SERVER__HOST)
    // while appsettings.json keeps its natural "Server:Host" casing -- so this
    // end-to-end path also locks in the case-folding override guarantee.
    // Without it, both Server:Host (JSON, 127.0.0.1) and SERVER:HOST (env,
    // 0.0.0.0) would survive the merge and the section bind would resolve the
    // stale JSON host, failing the describe() assertion below.
    setEnv("APP_SERVER__HOST", "0.0.0.0");

    const config = new ConfigBuilder()
      .addJsonFile(`${EXAMPLE_DIR}/appsettings.json`)
      .addJsonFile(`${EXAMPLE_DIR}/appsettings.Development.json`, { optional: true })
      .addEnvironmentVariables("APP_")
      .addCommandLine(["--Server:Port", "8080"])
      .build();

    const SERVER_CONFIG = "app/IServerConfig";
    const DB_PRIMARY = "app/IDatabaseConfig:primary";
    const DB_REPLICA = "app/IDatabaseConfig:replica";
    const API_SERVER = "app/IApiServer";
    const DATABASE_POOL = "app/IDatabasePool";

    const services = new DiBuilder<"singleton">();

    services.register(SERVER_CONFIG, {
      useFactory: () => bindConfig<ServerConfig>(config, SERVER_CONFIG_SCHEMA, { section: "Server" }),
      tag: "singleton",
    });
    services.register(DB_PRIMARY, {
      useFactory: () =>
        bindConfig<DatabaseConfig>(config, DATABASE_CONFIG_SCHEMA, { section: "Database:Primary" }),
      tag: "singleton",
    });
    services.register(DB_REPLICA, {
      useFactory: () =>
        bindConfig<DatabaseConfig>(config, DATABASE_CONFIG_SCHEMA, { section: "Database:Replica" }),
      tag: "singleton",
    });

    forCtor(ApiServer).signature(SERVER_CONFIG);
    forCtor(DatabasePool).signature(DB_PRIMARY, DB_REPLICA);

    services.add(API_SERVER, ApiServer).as("singleton");
    services.add(DATABASE_POOL, DatabasePool).as("singleton");

    const root = services.createScope("singleton");
    const server = root.resolve<ApiServer>(API_SERVER);
    const pool = root.resolve<DatabasePool>(DATABASE_POOL);
    const serverAgain = root.resolve<ApiServer>(API_SERVER);

    // Values: proves the full layering precedence resolved correctly --
    // Host from the env override, Port from the CLI override, Ssl from the
    // (optional, present) Development overlay.
    expect(server.describe()).toBe("listening on 0.0.0.0:8080 (tls)");
    expect(pool.describe()).toBe(
      "primary=db-primary.internal/app (pool 10), replica=db-replica.internal/app (pool 5)",
    );

    // DI: singleton caching, and two independent instances of the same
    // DatabaseConfig shape bound from two different config sections.
    expect(server).toBe(serverAgain);
    expect(ApiServer.built).toBe(1);
    expect(pool.primary).not.toBe(pool.replica);
    expect(pool.primary).toEqual({ host: "db-primary.internal", database: "app", poolSize: 10 });
    expect(pool.replica).toEqual({ host: "db-replica.internal", database: "app", poolSize: 5 });
  });
});
