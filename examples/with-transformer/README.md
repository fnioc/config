# @fnioc/config -- with the transformer

A sketch of `@fnioc/config` authored **interface-first** with its own
ts-patch transformer, layered on top of [`@fnioc/di`](https://github.com/fnioc/ioc).

> **This example does not build yet.** `@fnioc/config` doesn't exist as a
> package -- this is a design-review artifact: what the API and DX would look
> like, for review BEFORE any real implementation starts. See
> `../without-transformer` for the hand-written equivalent this would lower to.

## What it shows

- **Type-driven config registration**: `services.addConfig<ServerConfig>(config).as<"singleton">()`
  -- no schema, no token written by hand. The transformer walks `ServerConfig`'s
  declared shape and derives both automatically, exactly the way `add<I>(C)`
  derives a token from an interface today.
- **Constructor injection is unchanged**: `ApiServer(config: ServerConfig)`
  resolves the bound config like any other dependency -- @fnioc/config adds
  nothing new on the injection side. The only thing that decides "this
  resolves to bound configuration, not a `new`ed class" is which registration
  method (`addConfig` vs `add`) was used for that token.
- **Scope-derived freshness**: config caches (or doesn't) exactly like any
  other registration -- resolve it inside `"singleton"` and it's bound once;
  resolve it inside a shorter-lived scope instead and it's rebound fresh every
  time. No separate `IOptions`/`IOptionsSnapshot`/`IOptionsMonitor` tiers --
  fnioc's scopes already subsume that distinction.
- **Named instances of the same shape**: `DatabaseConfig` is registered twice
  (`Database:Primary`, `Database:Replica`) via `addConfig`'s explicit-token
  overload, and disambiguated at the injection site with the EXISTING
  `Inject<T,"tok">` brand -- no new "named options" concept.
- **Layered sources**: JSON base + optional per-environment JSON overlay + env
  vars (`APP_SERVER__HOST` -> `Server:Host`, the `__`-for-`:` convention since
  env vars can't hold literal colons everywhere) + CLI args, with the
  LAST-registered source winning per individual key (not a deep merge).

## How it works

`tspc` runs `@fnioc/config`'s transformer during `build`, alongside
`@fnioc/transformer`. Each `addConfig<T>(...)` call is rewritten to
`addFactory("<derived-token>", () => bindConfig(root, <generated-schema>)).as(...)`
-- inspect `dist/main.js` after building to see the lowered output.

The generated schema is exactly what you'd type by hand for the
`SchemaFor<T>`-checked version in `../without-transformer` -- see that
example's README for why the hand-written path is ALSO fully type-safe, not a
degraded fallback. The transformer's entire value-add here is not having to
write that schema yourself.

## Run it

Not runnable yet -- `@fnioc/config` doesn't exist. Once it does:

```sh
npm run build   # tspc compile to dist/
npm run start   # run it
```
