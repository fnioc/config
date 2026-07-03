# @fnioc/config

Constructor-injectable, layered configuration for [`@fnioc/di`](https://www.npmjs.com/package/@fnioc/di) — JSON files, environment variables, and CLI arguments layered into one configuration root, bound into a typed value via a schema that's checked against your interface at compile time. **No build step is required to use any of this.**

## Why

Config in a DI-shaped app has to end up as a plain constructor argument — something like `constructor(cfg: ServerConfig)`, not a live "ask the environment whenever you need a value" object threaded through every layer. `@fnioc/config` builds that constructor argument: it reads JSON/env/CLI, merges them in registration order (last source wins, per key — the same precedence model as .NET's `IConfiguration`), and binds the merged result into a typed `T` you hand to `@fnioc/di`'s `useFactory`.

The binding step is the part that usually isn't safe: hand-written "read this JSON blob into this interface" code silently drifts the moment someone adds a field to the interface and forgets the parsing code. `@fnioc/config` closes that gap with `SchemaFor<T>`, a type-level mapped/conditional type that mirrors `T`'s shape field-for-field. A schema literal you write by hand is checked by `tsc` against the interface it's meant to bind — missing a field, adding an extra one, using the wrong primitive kind, or forgetting to wrap an optional field all fail to compile. The schema and the interface can never silently drift apart, and this is enforced today, by plain `tsc --strict`, with no plugin or build step involved.

## What's in the MVP — and what's deliberately not

This release covers:

- **Layered sources** — `JsonFileSource`, `EnvironmentVariablesSource`, `CommandLineSource`, composed via `ConfigBuilder`.
- **`SchemaFor<T>`-checked binding** — hand-write a schema literal, get a compile error if it doesn't match `T`.
- **`bindConfig()`** — walks the schema against the merged config and produces a typed `T`, collecting every problem (missing keys, wrong-kind values, nested sections) into one `ConfigBindError` instead of failing on the first one.
- **Section-scoped binding** — bind the same shape from two different config sections into two independent instances (e.g. a primary and a replica database config), each wired to its own DI token.

**Not in this MVP: `addConfig<T>()` transformer sugar.** `@fnioc/di`'s ecosystem is built around a "lowering" story — a `@fnioc/transformer` ts-patch plugin that lets you author against a rich, type-driven surface and lowers it to the plain calls the runtime actually reads. A future `addConfig<T>()` would let the transformer derive and inject the schema for you, the same way it derives DI tokens today. **That transformer integration does not exist yet.** Everything in this package right now is the manual, hand-authored path — write your own `SchemaFor<T>` literal, call `bindConfig` yourself. This isn't a stopgap or a degraded fallback (see [Design philosophy](#design-philosophy) below) — it's the one and only path this version ships, and it's fully safe on its own. If you were expecting decorator- or transformer-driven config binding, it's coming later, not here yet.

## Install

```sh
npm install @fnioc/config @fnioc/di
```

## Quickstart

This mirrors the runnable example in [`examples/basic`](examples/basic) — see that directory for the full, working project (including two section-scoped bindings of the same shape).

Given `appsettings.json`:

```json
{
  "Server": {
    "Host": "127.0.0.1",
    "Port": 5000
  }
}
```

Optionally layer an environment-specific overlay, environment variables, and CLI args:

```json
// appsettings.Development.json (optional -- only applied if present)
{ "Server": { "Ssl": true } }
```

Build the merged configuration root, describe the target shape, and bind it:

```ts
import { bindConfig, ConfigBuilder } from "@fnioc/config";
import type { SchemaFor } from "@fnioc/config";

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

const config = new ConfigBuilder()
  .addJsonFile("appsettings.json")
  .addJsonFile("appsettings.Development.json", { optional: true })
  .addEnvironmentVariables("APP_") // APP_Server__Host -> "Server:Host"
  .addCommandLine(process.argv.slice(2)) // --Server:Port 8080
  .build();

const serverConfig = bindConfig<ServerConfig>(config, SERVER_CONFIG_SCHEMA, {
  section: "Server",
});
// { host: "127.0.0.1", port: 5000, ssl: true }, modulo whatever env/CLI overrides apply
```

Wire the bound value into `@fnioc/di` as a constructor argument, same as any other registration:

```ts
import { DiBuilder, forCtor } from "@fnioc/di";

const services = new DiBuilder<"singleton">();

services.register("app/IServerConfig", {
  useFactory: () => bindConfig<ServerConfig>(config, SERVER_CONFIG_SCHEMA, { section: "Server" }),
  tag: "singleton",
});

forCtor(ApiServer).signature("app/IServerConfig");
services.add("app/IApiServer", ApiServer).as("singleton");
```

`ApiServer`'s constructor just takes a plain `ServerConfig` — it never knows `@fnioc/config` exists.

## Design philosophy

`@fnioc/config` follows the same "lowering" ethos as `@fnioc/di` and the rest of the `ioc` toolkit: there's a rich, type-checked authoring surface, and underneath it a plain, hand-writable substrate that the rich surface eventually compiles down to. In `@fnioc/di`, that substrate is string tokens and positional dep arrays; here, it's a schema literal and a `bindConfig()` call.

The important part of that story, and the one this MVP is built to prove: **the manual path is not a degraded fallback you tolerate until the transformer sugar ships.** It's fully type-safe, fully tested, and it's what every consumer of this package uses today, transformer or not. When `addConfig<T>()` does arrive, it will be sugar that *generates* the same `SchemaFor<T>` + `bindConfig()` call shown above — not a parallel system with its own guarantees. If you never adopt the transformer, you lose no correctness, only some typing.

## API surface

| Export | What it does |
|---|---|
| `ConfigBuilder` | Registers sources (`.addJsonFile`, `.addEnvironmentVariables`, `.addCommandLine`) and merges them into a `ConfigurationRoot` via `.build()`. |
| `ConfigurationRoot` | Read-only merged view over flat, colon-delimited keys (`.get`, `.getSection`, `.keys`). |
| `bindConfig<T>(root, schema, opts?)` | Binds a `ConfigurationRoot` (optionally narrowed via `opts.section`) into a typed `T`, per a `SchemaFor<T>`. |
| `ConfigBindError` | Thrown by `bindConfig` with every issue found across the whole shape, not just the first. |
| `SchemaFor<T>` | Type-level mapped/conditional type: the schema shape that exactly matches interface `T`. |
| `Schema` / `Infer<S>` | The type-level inverse: write a schema value first, derive its bound type from it. |
| `JsonFileSource`, `EnvironmentVariablesSource`, `CommandLineSource` | The three built-in `ConfigSource` implementations. |
| `ConfigSource` | The interface any custom source must implement: flatten your input into `Record<string, string>`. |

Every export above has its own JSDoc in `src/` — hover in your editor for the details (section-scoping rules, key-casing behavior, per-source flattening conventions, etc.).

## Development

Branch policy, commit conventions, TDD requirements, and the semantic-release-based `@next` → `@latest` publish flow are documented in [`CLAUDE.md`](CLAUDE.md). In short: every PR merge to `main` ships a `@next` pre-release automatically; promotion to `@latest` is a manual, reviewer-gated step.
