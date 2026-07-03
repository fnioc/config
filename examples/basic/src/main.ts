// A standalone, runnable `@fnconfig/config` consumer -- no dependency-
// injection framework, no compiler transformer, no decorators. Just a
// `ConfigurationBuilder` over layered sources, bound into typed values via
// `bindConfig()` and a hand-written `SchemaFor<T>`.
//
// Config layering (last source registered wins, per key):
//   in-memory defaults -> appsettings.json -> appsettings.Development.json
//   (optional overlay) -> environment variables (APP_ prefix) -> command-line
//   arguments.
//
// `bun run start` fixes an environment variable and a command-line argument
// so the printed output is deterministic: Host comes from the env override,
// Port from the CLI override, and Ssl from the Development overlay --
// proving every layer actually takes effect, in precedence order.

import { bindConfig, ConfigurationBuilder } from "@fnconfig/config";
import type { SchemaFor } from "@fnconfig/config";
// Bare side-effect imports install addJsonFile / addEnvironmentVariables /
// addCommandLine onto ConfigurationBuilder from each provider package. No
// import is needed for addInMemoryCollection -- it ships directly on
// @fnconfig/config.
import "@fnconfig/json";
import "@fnconfig/env";
import "@fnconfig/commandline";

import type { DatabaseConfig, ServerConfig } from "./contracts.js";

const config = new ConfigurationBuilder()
  .addInMemoryCollection({
    "Server:Host": "0.0.0.0",
    "Server:Port": "80",
  })
  .addJsonFile("appsettings.json")
  .addJsonFile("appsettings.Development.json", { optional: true })
  .addEnvironmentVariables({ prefix: "APP_" })
  .addCommandLine(process.argv.slice(2))
  .build();

// Hand-written schemas, checked against SchemaFor<T>: a missing key, an extra
// key, a wrong primitive kind, or a bare (unwrapped) optional field on either
// interface is a compile error here, not a runtime surprise.
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

const server = bindConfig<ServerConfig>(config, SERVER_CONFIG_SCHEMA, { section: "Server" });

// Two instances of the SAME DatabaseConfig shape, each bound from its own
// config section -- proof that section-scoped binding yields independent
// values from one reusable schema.
const primary = bindConfig<DatabaseConfig>(config, DATABASE_CONFIG_SCHEMA, { section: "Database:Primary" });
const replica = bindConfig<DatabaseConfig>(config, DATABASE_CONFIG_SCHEMA, { section: "Database:Replica" });

const lines = [
  "=== @fnconfig/config -- basic ===",
  `server: ${JSON.stringify(server)}`,
  `database primary: ${JSON.stringify(primary)}`,
  `database replica: ${JSON.stringify(replica)}`,
  `looked up directly: Server:Host=${config.get("Server:Host")}, Server:Port=${config.get("Server:Port")}`,
];

for (const line of lines) {
  console.log(line);
}
