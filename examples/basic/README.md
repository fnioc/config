# basic

A standalone, runnable consumer of `@fnconfig/config` + its three provider
packages (`@fnconfig/json`, `@fnconfig/env`, `@fnconfig/commandline`) -- no
dependency-injection framework, no compiler transformer, no decorators.

```sh
bun install
bun run start
```

`start` rebuilds (`moon run examples-basic:build`, i.e. plain `tsc`) and then
runs `dist/main.js` with a fixed environment variable and command-line
argument, so the printed output is deterministic:

```
=== @fnconfig/config -- basic ===
server: {"host":"10.0.0.5","port":8080,"ssl":true}
database primary: {"host":"db-primary.internal","database":"app","poolSize":10}
database replica: {"host":"db-replica.internal","database":"app","poolSize":5}
looked up directly: Server:Host=10.0.0.5, Server:Port=8080
```

## What this demonstrates

- **Layered sources**: an in-memory default collection (lowest precedence) <-
  `appsettings.json` (base) <- `appsettings.Development.json` (optional
  overlay, present here) <- environment variables (`APP_` prefix) <-
  command-line arguments (highest precedence), each source overriding the
  previous one key-by-key. The final `Host` comes from the env override,
  `Port` from the CLI override, and `Ssl` from the Development overlay --
  proving every layer actually applies, in precedence order.
- **Provider packages via side-effect imports**: `addJsonFile`,
  `addEnvironmentVariables`, and `addCommandLine` are not baked into
  `ConfigurationBuilder` -- each is contributed by its own provider package
  (`@fnconfig/json` / `-env` / `-commandline`) through TS declaration merging
  + a prototype patch. `src/main.ts` brings them in with bare
  `import "@fnconfig/json";` lines alongside the named `@fnconfig/config`
  import. `addInMemoryCollection` needs no such import -- it ships directly
  on `@fnconfig/config`.
- **`SchemaFor<T>`-checked hand-written schemas**: `SERVER_CONFIG_SCHEMA` and
  `DATABASE_CONFIG_SCHEMA` in `src/main.ts` are typed `SchemaFor<ServerConfig>`
  / `SchemaFor<DatabaseConfig>`. Get a field wrong -- missing, extra, wrong
  primitive kind, or a bare (unwrapped) optional -- and `tsc` rejects it; this
  is checked against the real, built `@fnconfig/config` package, not a design
  sketch.
- **Section-scoped binding, twice, of the same shape**: `primary` and
  `replica` are both bound from `DATABASE_CONFIG_SCHEMA`, one from the
  `Database:Primary` section and one from `Database:Replica` -- proof that a
  single reusable schema binds independent values out of different sections.
