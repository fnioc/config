// The plugin-less wiring + entry point for a REAL, runnable @fnioc/config
// consumer -- no transformer, no decorators, no reflect-metadata. Everything
// the transformer would otherwise generate is written out by hand here:
//
//   1. `services.add("app/IApiServer", ApiServer)` -- the string token.
//   2. `forCtor(ApiServer).signature(...)` -- the constructor dependency
//      metadata (@fnioc/di's manual-authoring surface).
//   3. `SERVER_CONFIG_SCHEMA` / `DATABASE_CONFIG_SCHEMA` -- the bind schemas,
//      written by hand but still checked against `SchemaFor<T>`: a missing
//      key, an extra key, a wrong primitive kind, or a bare (unwrapped)
//      optional field on either interface is a COMPILE error here, not a
//      runtime surprise. This is the actual compile-time check running
//      against the real, built @fnioc/config package -- not a design sketch.
//
// Config layering (last source wins, per key):
//   appsettings.json -> appsettings.Development.json (optional overlay)
//   -> env vars (APP_ prefix) -> CLI args
//
// `bun run start` fixes the env var and CLI arg for a deterministic result:
// Host comes from the env override (0.0.0.0), Port from the CLI override
// (8080), and Ssl from the Development overlay (true) -- proving all four
// layers actually take effect, in precedence order.

import { bindConfig, ConfigBuilder } from "@fnioc/config";
import type { SchemaFor } from "@fnioc/config";
import { DiBuilder, forCtor } from "@fnioc/di";

import type { DatabaseConfig, ServerConfig } from "./contracts.js";
import { ApiServer, DatabasePool } from "./services.js";

const config = new ConfigBuilder()
  .addJsonFile("appsettings.json")
  .addJsonFile("appsettings.Development.json", { optional: true })
  .addEnvironmentVariables("APP_")
  .addCommandLine(process.argv.slice(2))
  .build();

// Hand-written schemas, checked against SchemaFor<T> -- see the module
// comment above for exactly what that buys us at compile time.
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

// Our chosen tokens. A transformer would derive source-relative ones; any
// stable string works for the plugin-less path.
const SERVER_CONFIG = "app/IServerConfig";
const DB_PRIMARY = "app/IDatabaseConfig:primary";
const DB_REPLICA = "app/IDatabaseConfig:replica";
const API_SERVER = "app/IApiServer";
const DATABASE_POOL = "app/IDatabasePool";

const services = new DiBuilder<"singleton">();

// @fnioc/di's real, published override path is `.register(token, spec)`
// with a `{ useFactory, tag }` spec -- there is no `addFactory(token, fn).as(scope)`
// sugar on `DiBuilder` (see README.md in this directory for why that matters).
// @fnioc/config contributes no new DI primitive at all here -- only
// `bindConfig()` (the runtime binder) and `ConfigBuilder`/the sources above.
//
// NOTE: `bindConfig`'s `T` is given an explicit type argument below. It does
// NOT infer from the `schema: SchemaFor<T>` parameter alone: `SchemaFor<T>`'s
// top-level shape is `[T] extends [...] ? ... : ...` (a distributive-blocking
// tuple-wrapped conditional), which defeats TypeScript's homomorphic-mapped-
// type inference -- so `T` can never be recovered from a `SchemaFor<T>`-typed
// argument's static type under real, strict `tsc`. The workaround is simply
// always naming `T` explicitly, as below.
services.register(SERVER_CONFIG, {
  useFactory: () => bindConfig<ServerConfig>(config, SERVER_CONFIG_SCHEMA, { section: "Server" }),
  tag: "singleton",
});

// Two instances of the SAME DatabaseConfig shape, each bound from its own
// config section, each registered under its own explicit token -- proof
// that section-scoped binding and multiple instances of one shape both work.
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

// Hand-written dependency metadata -- the fluent equivalent of the
// `defineDeps(...)` a transformer would emit.
forCtor(ApiServer).signature(SERVER_CONFIG);
forCtor(DatabasePool).signature(DB_PRIMARY, DB_REPLICA);

services.add(API_SERVER, ApiServer).as("singleton");
services.add(DATABASE_POOL, DatabasePool).as("singleton");

const root = services.createScope("singleton");
const server = root.resolve<ApiServer>(API_SERVER);
const pool = root.resolve<DatabasePool>(DATABASE_POOL);

const lines = [
  "=== @fnioc/config -- without transformer ===",
  server.describe(),
  pool.describe(),
  `ApiServer instances built: ${ApiServer.built}`,
  `DatabasePool instances built: ${DatabasePool.built}`,
  `primary and replica are distinct instances: ${pool.primary !== pool.replica}`,
];

for (const line of lines) {
  console.log(line);
}
