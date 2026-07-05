# @fnconfig

Layered, provider-based configuration for TypeScript — JSON files, environment
variables, and CLI arguments composed into one configuration tree, bound into
a typed value via a schema that's checked against your interface at compile
time. **No build step is required to use any of this.**

## Why

Most apps need config to end up as a single, plain, typed object — not a live
"ask the environment whenever you need a value" object threaded through every
layer. `@fnconfig/config` builds that object: it reads JSON/env/CLI, merges
them in registration order (last source wins, per key), and binds the merged
result into a typed `T`.

The binding step is the part that usually isn't safe: hand-written "read this
JSON blob into this interface" code silently drifts the moment someone adds a
field to the interface and forgets the parsing code. `@fnconfig/config` closes
that gap with `SchemaFor<T>`, a type-level mapped/conditional type that mirrors
`T`'s shape field-for-field. A schema literal you write by hand is checked by
`tsc` against the interface it's meant to bind — missing a field, adding an
extra one, using the wrong primitive kind, or forgetting to wrap an optional
field all fail to compile. The schema and the interface can never silently
drift apart, and this is enforced today, by plain `tsc --strict`, with no
plugin or build step involved.

## Packages

| Package | Role |
|---|---|
| [`@fnconfig/core`](packages/core) | Types-only configuration abstractions (`IConfiguration*` interfaces). Zero runtime. |
| [`@fnconfig/config`](packages/config) | The engine: `ConfigurationBuilder`/`ConfigurationRoot`/`ConfigurationSection`, the Memory provider, `bindConfig`, and the schema types. |
| [`@fnconfig/json`](packages/config-json) | JSON file provider (`.addJsonFile()`). |
| [`@fnconfig/env`](packages/config-env) | Environment variable provider (`.addEnvironmentVariables()`). |
| [`@fnconfig/commandline`](packages/config-commandline) | Command-line argument provider (`.addCommandLine()`). |
| [`@fnconfig/transformer`](packages/config-transformer) | ts-patch transformer: lowers `.withType<T>()` to a generated `.withSchema({...})` at compile time. |

## What's in the MVP — and what's deliberately not

This release covers:

- **Layered sources** — an in-memory source built into `@fnconfig/config`,
  plus `@fnconfig/json`, `@fnconfig/env`, and `@fnconfig/commandline`,
  composed via `ConfigurationBuilder`.
- **`SchemaFor<T>`-checked binding** — hand-write a schema literal, get a
  compile error if it doesn't match `T`.
- **`bindConfig()`** — walks the schema against the merged config and produces
  a typed `T`, collecting every problem (missing keys, wrong-kind values,
  nested sections) into one `ConfigBindError` instead of failing on the first
  one.
- **Section-scoped binding** — bind the same shape from two different config
  sections into two independent instances (e.g. a primary and a replica
  database config).

Everything in this library right now is the manual, hand-authored path —
write your own `SchemaFor<T>` literal, call `bindConfig` yourself. There's no
decorator- or codegen-driven binding; the schema is a plain value you write
and `tsc` checks.

## Install

```sh
npm install @fnconfig/config @fnconfig/json @fnconfig/env @fnconfig/commandline
```

## Quickstart

This mirrors the runnable example in [`examples/basic`](examples/basic) — see
that directory for the full, working project (including two section-scoped
bindings of the same shape).

Given `appsettings.json`:

```json
{
  "Server": {
    "Host": "127.0.0.1",
    "Port": 5000
  }
}
```

Optionally layer an environment-specific overlay, environment variables, and
CLI args:

```json
// appsettings.Development.json (optional -- only applied if present)
{ "Server": { "Ssl": true } }
```

Build the merged configuration root, describe the target shape, and bind it:

```ts
import { bindConfig, ConfigurationBuilder } from "@fnconfig/config";
import type { SchemaFor } from "@fnconfig/config";
import "@fnconfig/json";
import "@fnconfig/env";
import "@fnconfig/commandline";

interface ServerConfig {
  readonly host: string;
  readonly port: number;
  readonly ssl?: boolean;
}

// Checked against ServerConfig by tsc: get a field wrong (missing, extra,
// wrong primitive, or a bare unwrapped optional) and this line fails to compile.
const SERVER_CONFIG_SCHEMA: SchemaFor<ServerConfig> = {
  host: "string",
  port: "number",
  ssl: { optional: "boolean" },
};

const config = new ConfigurationBuilder()
  .addJsonFile("appsettings.json")
  .addJsonFile("appsettings.Development.json", { optional: true })
  .addEnvironmentVariables({ prefix: "APP_" }) // APP_Server__Host -> "Server:Host"
  .addCommandLine(process.argv.slice(2)) // --Server:Port 8080
  .build();

const serverConfig = bindConfig<ServerConfig>(config, SERVER_CONFIG_SCHEMA, {
  section: "Server",
});
// { host: "127.0.0.1", port: 5000, ssl: true }, modulo whatever env/CLI overrides apply
```

`serverConfig` is a plain typed object — hand it to whatever wiring your app
already uses (a constructor argument, a module-level singleton, whatever
shape fits).

## API surface

| Export | What it does |
|---|---|
| `ConfigurationBuilder` | Registers sources (`.addJsonFile`, `.addEnvironmentVariables`, `.addCommandLine`, `.addInMemoryCollection`) and merges them into a `ConfigurationRoot` via `.build()`. |
| `ConfigurationRoot` | Read-only merged view over flat, colon-delimited keys (`.get`, `.getSection`, `.keys`). |
| `bindConfig<T>(root, schema, opts?)` | Binds a `ConfigurationRoot` (optionally narrowed via `opts.section`) into a typed `T`, per a `SchemaFor<T>`. |
| `ConfigBindError` | Thrown by `bindConfig` with every issue found across the whole shape, not just the first. |
| `SchemaFor<T>` | Type-level mapped/conditional type: the schema shape that exactly matches interface `T`. |
| `Schema` / `Infer<S>` | The type-level inverse: write a schema value first, derive its bound type from it. |

Every export above has its own JSDoc in `src/` — hover in your editor for the
details (section-scoping rules, key-casing behavior, per-source flattening
conventions, etc.).

## Development

Branch policy, commit conventions, TDD requirements, and the
semantic-release-based `@next` → `@latest` publish flow are documented in
[`CLAUDE.md`](CLAUDE.md). In short: every PR merge to `main` ships a `@next`
pre-release automatically; promotion to `@latest` is a manual, reviewer-gated
step.
