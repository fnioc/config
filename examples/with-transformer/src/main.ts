// The type-driven wiring + entry point.
//
// Registration is authored interface-first: `services.addConfig<ServerConfig>(config)`
// carries no schema and no token. At build time @fnioc/config's transformer
// walks ServerConfig's declared shape and rewrites the call to the
// explicit-token / schema-literal form -- inspect dist/main.js after building
// to see the lowered output (mirrors ioc's own with-transformer example).
//
// This file also demonstrates:
//   - layered sources: JSON base + optional per-env JSON overlay + env vars +
//     CLI args, later source wins PER KEY (not a deep merge)
//   - named instances of the SAME config shape (Database:Primary / :Replica)
//     via addConfig's explicit-token overload + the EXISTING Inject<T,"tok">
//     brand at the injection site -- no new "named options" mechanism

import { ServiceManifest } from "@fnioc/di";
import { ConfigBuilder } from "@fnioc/config";

import type { DatabaseConfig, IApiServer, IDatabasePool, ServerConfig } from "./contracts.js";
import { ApiServer, DatabasePool } from "./services.js";

// Layered sources. Each source flattens its own input into a flat,
// colon-delimited key->value map; lookup goes back-to-front, LAST-registered
// source wins PER KEY. Env vars map `APP_SERVER__HOST` -> strip the "APP_"
// prefix -> `__` becomes `:` -> "Server:Host" (the .NET convention -- env
// vars can't contain `:` on every platform). CLI switch mappings are
// explicit; an unmapped short switch (`-x`) is a hard parse-time error.
const config = new ConfigBuilder()
  .addJsonFile("appsettings.json")
  .addJsonFile("appsettings.Development.json", { optional: true })
  .addEnvironmentVariables("APP_")
  .addCommandLine(process.argv.slice(2), {
    switchMappings: { "-p": "Server:Port" },
  })
  .build();

// `singleton` is the only scope tag this app opens -- there is no root:
// scopes are uniform tags (see @fnioc/di's design philosophy).
const services = new ServiceManifest<"singleton">();

// Type-driven config registration. The transformer derives BOTH the token
// (Rule 1, same derivation `add<I>(C)` uses) and the bind schema from
// ServerConfig's declared shape -- nothing is written by hand.
services.addConfig<ServerConfig>(config).as<"singleton">();

// Named instances: explicit token (mirrors add(token, C)), bound from two
// different sections of the SAME merged config. The type param still drives
// the generated schema -- only the token is pinned by hand, because two
// registrations of the same derived token would just overwrite each other
// (ServiceManifest keeps the MOST RECENT registration per token, there's no
// "resolve all" fan-out).
services.addConfig<DatabaseConfig>("cfg:db-primary", config, { section: "Database:Primary" }).as<"singleton">();
services.addConfig<DatabaseConfig>("cfg:db-replica", config, { section: "Database:Replica" }).as<"singleton">();

services.add<IApiServer>(ApiServer).as<"singleton">();
services.add<IDatabasePool>(DatabasePool).as<"singleton">();

// build() returns a frameless provider -- open "singleton" explicitly so
// singleton-tagged registrations (including the config ones) cache for the
// app's lifetime. This is ALSO how freshness works for config: resolve it
// inside a shorter-lived scope (e.g. "request") instead, and you get a fresh
// bind on every resolve within that scope -- no separate IOptions/IOptionsSnapshot/
// IOptionsMonitor tiering, just the scope you happened to resolve in.
const root = services.build().createScope("singleton");

const server = root.resolve<IApiServer>("./contracts/IApiServer");
const pool = root.resolve<IDatabasePool>("./contracts/IDatabasePool");

const lines = [
  "=== @fnioc/config -- with transformer ===",
  server.describe(),
  pool.describe(),
];

for (const line of lines) {
  console.log(line);
}
