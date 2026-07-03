# without-transformer

A real, runnable consumer of `@fnconfig/config` + its three provider packages
(`@fnconfig/json`, `@fnconfig/env`, `@fnconfig/commandline`) + the
real, published `@fnioc/di` (`^1.0.0`) -- no ts-patch transformer, no
decorators, no reflect-metadata.

```sh
bun install
bun run start
```

`start` rebuilds (`moon run examples-without-transformer:build`, i.e. plain
`tsc`) and then runs `dist/main.js` with a fixed environment variable and CLI
argument, so the printed output is deterministic:

```
=== @fnconfig/config -- without transformer ===
listening on 0.0.0.0:8080 (tls)
primary=db-primary.internal/app (pool 10), replica=db-replica.internal/app (pool 5)
ApiServer instances built: 1
DatabasePool instances built: 1
primary and replica are distinct instances: true
```

## What this demonstrates

- **Layered sources**: `appsettings.json` (base) <- `appsettings.Development.json`
  (optional overlay, present here) <- environment variables (`APP_` prefix)
  <- CLI args, each source overriding the previous one key-by-key. The final
  `Host` comes from the env override, `Port` from the CLI override, and `Ssl`
  from the Development overlay -- proving all four layers actually apply, in
  precedence order.
- **Provider packages via side-effect imports**: `addJsonFile`,
  `addEnvironmentVariables`, and `addCommandLine` are not baked into
  `ConfigurationBuilder` -- each is contributed by its own provider package
  (`@fnconfig/json` / `-env` / `-commandline`) through TS declaration
  merging + a prototype patch, mimicking a C# extension method. `src/main.ts`
  brings them in with bare `import "@fnconfig/json";` lines (the
  `using Microsoft.Extensions.Configuration.Json;` equivalent) alongside the
  named `@fnconfig/config` import.
- **`SchemaFor<T>`-checked hand-written schemas**: `SERVER_CONFIG_SCHEMA` and
  `DATABASE_CONFIG_SCHEMA` in `src/main.ts` are typed `SchemaFor<ServerConfig>`
  / `SchemaFor<DatabaseConfig>`. Get a field wrong -- missing, extra, wrong
  primitive kind, or a bare (unwrapped) optional -- and `tsc` rejects it; this
  is checked against the real, built `@fnconfig/config` package, not a design
  sketch.
- **Constructor injection of bound config**: `ApiServer` takes a bound
  `ServerConfig` in its constructor; wiring is `services.register(token, {
  useFactory: () => bindConfig(config, SCHEMA), tag: "singleton" })` +
  `forCtor(ApiServer).signature(token)` + `services.add(token, ApiServer).as("singleton")`.
- **Section-scoped binding, twice, of the same shape**: `DatabasePool` takes
  TWO `DatabaseConfig` instances, one bound from the `Database:Primary`
  section and one from `Database:Replica`, each registered under its own
  explicit token -- proof that the same schema can be reused for independent,
  simultaneously-resolvable instances.

## A note on `@fnioc/di`'s real API

The registration override path on the real, published `DiBuilder` (`^1.0.0`)
is `.register(token, { useFactory, tag })` -- there is no `addFactory(token,
fn).as(scope)` sugar method. This example uses the real, installed API;
an earlier design sketch (elsewhere in this repo's history) assumed the
`addFactory(...).as(...)` shape against an unpublished, ahead-of-`^1.0.0`
API surface that isn't what `npm install @fnioc/di` actually gives you today.
