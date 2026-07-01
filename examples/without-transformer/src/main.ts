// The plugin-less wiring + entry point. The SAME app as ../../with-transformer,
// wired by hand. Without the transformer there is no type-driven `addConfig<T>`
// authoring -- but the hand-written schema is NOT a "trust me" literal: it is
// typed against `SchemaFor<T>`, a plain mapped type @fnioc/config exports, so
// TypeScript checks it against ServerConfig's/DatabaseConfig's ACTUAL declared
// shape at compile time. A missing key, an extra key, or a wrong primitive kind
// is a compile error -- no transformer, no decorators, no reflect-metadata.
// This is exactly what the transformer would generate for you; its only
// remaining job is not having to write this by hand (DRY, not correctness).
//
// The three things the transformer would have done automatically:
//   1. `services.add("app/IServerConfig", ...)` -- the string token, written out.
//   2. `forCtor(ApiServer).signature(...)` -- the constructor dependency metadata.
//   3. `SERVER_CONFIG_SCHEMA` -- the bind schema, written out (but still checked).

import { ServiceManifest, forCtor } from "@fnioc/di";
import { ConfigBuilder, bindConfig } from "@fnioc/config";
import type { SchemaFor } from "@fnioc/config";

import type { DatabaseConfig, ServerConfig } from "./contracts.js";
import { ApiServer, DatabasePool } from "./services.js";

// Sources: same layering as the with-transformer example -- last source wins
// PER KEY. @fnioc/config's ConfigBuilder/sources are ordinary runtime code;
// they are identical with or without the transformer (nothing about layered
// merging is type-driven).
const config = new ConfigBuilder()
  .addJsonFile("appsettings.json")
  .addJsonFile("appsettings.Development.json", { optional: true })
  .addEnvironmentVariables("APP_")
  .addCommandLine(process.argv.slice(2), {
    switchMappings: { "-p": "Server:Port" },
  })
  .build();

// Hand-written schemas, checked against SchemaFor<T>:
//   - every key of T must appear (completeness)
//   - no extra keys (excess-property checking on the literal)
//   - primitive kinds must match T's field types
//   - an optional field in T MUST be wrapped `{ optional: ... }`
// Get any of that wrong and this is a compile error, not a runtime surprise.
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

// Our chosen tokens. The transformer would have derived source-relative ones
// (`./contracts/ServerConfig`); plugin-less, any stable string works.
const SERVER_CONFIG = "app/IServerConfig";
const DB_PRIMARY = "cfg:db-primary";
const DB_REPLICA = "cfg:db-replica";
const API_SERVER = "app/IApiServer";
const DATABASE_POOL = "app/IDatabasePool";

const services = new ServiceManifest<"singleton">();

// addFactory(token, fn).as(scope) is @fnioc/di's EXISTING low-level API.
// @fnioc/config contributes no new DI primitive here at all -- only
// bindConfig() (the runtime binder) and ConfigBuilder/the sources above.
// Freshness works exactly like every other factory registration: `.as()`
// ties it to a scope; resolve it inside a shorter-lived scope instead and
// you get a fresh bind every time, no separate Options/Snapshot/Monitor tiers.
services
  .addFactory(SERVER_CONFIG, () => bindConfig(config, SERVER_CONFIG_SCHEMA))
  .as("singleton");
services
  .addFactory(DB_PRIMARY, () =>
    bindConfig(config, DATABASE_CONFIG_SCHEMA, { section: "Database:Primary" }))
  .as("singleton");
services
  .addFactory(DB_REPLICA, () =>
    bindConfig(config, DATABASE_CONFIG_SCHEMA, { section: "Database:Replica" }))
  .as("singleton");

// Hand-written dependency metadata -- the fluent equivalent of the
// defineDeps(...) the transformer emits. DatabasePool's two same-shape deps
// are disambiguated purely by ORDER here (no Inject brand needed -- that
// brand is inert without the transformer reading it).
forCtor(ApiServer).signature(SERVER_CONFIG);
forCtor(DatabasePool).signature(DB_PRIMARY, DB_REPLICA);

services.add(API_SERVER, ApiServer).as("singleton");
services.add(DATABASE_POOL, DatabasePool).as("singleton");

const root = services.build().createScope("singleton");
const server = root.resolve<ApiServer>(API_SERVER);
const pool = root.resolve<DatabasePool>(DATABASE_POOL);

const lines = [
  "=== @fnioc/config -- without transformer ===",
  server.describe(),
  pool.describe(),
];

for (const line of lines) {
  console.log(line);
}
