// End-to-end interop: ConfigurationBuilder -> bindConfig -> @fnioc/di
// resolution, wired through the REAL published `@fnioc/di` (^1.0.0) and the
// BUILT DIST of @fnioc/config + all three provider packages (this runs under
// `node`, so every `@fnioc/*` bare import resolves to `dist/index.js` -- see
// moon.yml). This is the test that proves the whole pipeline works TOGETHER
// through the artefacts a real consumer installs -- the layered config sources
// (each contributed by a separately-bundled provider), the schema binder, and
// the DI container -- not just the pieces in isolation.
//
// The service classes and config interfaces are inlined here rather than
// imported from examples/without-transformer: importing that example's `.ts`
// source across a package boundary is fragile under node's type-stripping
// loader (its relative imports use `.js` specifiers that only tsc rewrites),
// and an against-dist integration package should not reach into an example's
// internals. The scenario -- layering, section binds, singleton caching, two
// instances of one shape -- is reproduced faithfully; the appsettings fixtures
// are local copies of the exact files the example ships.

import assert from "node:assert/strict";
import { join } from "node:path";
import { afterEach, describe, test } from "node:test";

import { bindConfig, ConfigurationBuilder } from "@fnioc/config";
import type { SchemaFor } from "@fnioc/config";
import "@fnioc/config-json";
import "@fnioc/config-env";
import "@fnioc/config-commandline";
import { DiBuilder, forCtor } from "@fnioc/di";

const FIXTURES = join(import.meta.dirname, "fixtures");

interface ServerConfig {
  readonly host: string;
  readonly port: number;
  readonly ssl?: boolean;
}

interface DatabaseConfig {
  readonly host: string;
  readonly database: string;
  readonly poolSize: number;
}

// NB: no TS parameter properties (`constructor(private x)`) here -- node's
// strip-only TS loader rejects them (they need a real transform, not type
// erasure). Fields are declared and assigned explicitly instead. The example
// keeps parameter properties because it's compiled by tsc, not run raw.
class ApiServer {
  public static built = 0;
  readonly #config: ServerConfig;

  public constructor(config: ServerConfig) {
    this.#config = config;
    ApiServer.built += 1;
  }

  public describe(): string {
    const tls = this.#config.ssl ? " (tls)" : "";
    return `listening on ${this.#config.host}:${this.#config.port}${tls}`;
  }
}

class DatabasePool {
  public static built = 0;
  public readonly primary: DatabaseConfig;
  public readonly replica: DatabaseConfig;

  public constructor(primary: DatabaseConfig, replica: DatabaseConfig) {
    this.primary = primary;
    this.replica = replica;
    DatabasePool.built += 1;
  }

  public describe(): string {
    const p = this.primary;
    const r = this.replica;
    return (
      `primary=${p.host}/${p.database} (pool ${p.poolSize}), `
      + `replica=${r.host}/${r.database} (pool ${r.poolSize})`
    );
  }
}

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
  ApiServer.built = 0;
  DatabasePool.built = 0;
});

describe("end-to-end: ConfigurationBuilder -> bindConfig -> DI resolution (built dist)", () => {
  test("resolves a constructor-injected ApiServer and two section-bound DatabaseConfig instances", () => {
    // Same layering the example demonstrates: JSON base <- JSON dev overlay
    // <- env vars (APP_ prefix) <- CLI args, last-registered-wins per key. The
    // env name is deliberately conventional UPPERCASE (APP_SERVER__HOST) while
    // appsettings.json keeps its natural "Server:Host" casing -- so this path
    // also locks in the case-folding override guarantee end to end.
    setEnv("APP_SERVER__HOST", "0.0.0.0");

    const config = new ConfigurationBuilder()
      .addJsonFile(join(FIXTURES, "appsettings.json"))
      .addJsonFile(join(FIXTURES, "appsettings.Development.json"), { optional: true })
      .addEnvironmentVariables({ prefix: "APP_" })
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
      useFactory: () => bindConfig<DatabaseConfig>(config, DATABASE_CONFIG_SCHEMA, { section: "Database:Primary" }),
      tag: "singleton",
    });
    services.register(DB_REPLICA, {
      useFactory: () => bindConfig<DatabaseConfig>(config, DATABASE_CONFIG_SCHEMA, { section: "Database:Replica" }),
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

    // Values: proves the full layering precedence resolved correctly -- Host
    // from the env override, Port from the CLI override, Ssl from the
    // (optional, present) Development overlay.
    assert.equal(server.describe(), "listening on 0.0.0.0:8080 (tls)");
    assert.equal(
      pool.describe(),
      "primary=db-primary.internal/app (pool 10), replica=db-replica.internal/app (pool 5)",
    );

    // DI: singleton caching, and two independent instances of the same
    // DatabaseConfig shape bound from two different config sections.
    assert.equal(server, serverAgain);
    assert.equal(ApiServer.built, 1);
    assert.notEqual(pool.primary, pool.replica);
    assert.deepEqual(pool.primary, { host: "db-primary.internal", database: "app", poolSize: 10 });
    assert.deepEqual(pool.replica, { host: "db-replica.internal", database: "app", poolSize: 5 });
  });
});
