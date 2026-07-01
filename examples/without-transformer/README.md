# @fnioc/config -- without the transformer

The SAME app as `../with-transformer`, wired entirely by hand -- no ts-patch
transformer, no decorators, no `reflect-metadata`.

> **This example does not build yet.** `@fnioc/config` doesn't exist as a
> package -- this is a design-review artifact, not a working demo.

## What it shows

- **`SchemaFor<T>`-checked hand-written bind schemas.** This is the important
  one: `SERVER_CONFIG_SCHEMA: SchemaFor<ServerConfig> = { host: "string", ... }`
  is not a "trust me" literal you could get subtly wrong -- TypeScript checks
  it against `ServerConfig`'s ACTUAL declared shape at compile time. Try any
  of these in `main.ts` and watch it fail to compile:
  - drop a key (`port`) -- "missing property" error.
  - add one that doesn't exist on the interface -- excess-property error.
  - get a primitive kind wrong (`port: "string"`) -- type mismatch.
  - forget the `{ optional: ... }` wrapper on `ssl` -- type mismatch.

  `SchemaFor<T>` is a plain mapped type `@fnioc/config` exports -- no plugin
  produces it, no plugin is required to benefit from it. **This is the direct
  answer to "can I register an open generic with zero compiler plugin and
  still get real safety" -- yes, on plain interfaces, today's TypeScript,
  no witness value, no reflection.** The transformer in `../with-transformer`
  generates the exact same schema shape for you; its entire value-add is not
  having to write it, not correctness -- correctness holds either way.
- **Explicit tokens** (`"app/IServerConfig"`, `"cfg:db-primary"`, ...) instead
  of transformer-derived ones. Any stable string works.
- **Hand-written dependency metadata** via `forCtor(...).signature(...)` --
  the fluent equivalent of the `defineDeps(...)` the transformer emits.
- **`addFactory(token, fn).as(scope)`** -- @fnioc/di's EXISTING low-level API.
  `@fnioc/config` contributes NO new DI runtime primitive in this path at
  all -- only `bindConfig()` (the binder) and `ConfigBuilder`/the sources,
  which are ordinary runtime code, identical with or without the transformer.
- **No `Inject<T,"tok">` brand** in `services.ts` -- without the transformer
  that brand is inert (a phantom field nobody reads), so `DatabasePool`'s two
  same-shape params are disambiguated purely by the ORDER of tokens passed to
  `forCtor(DatabasePool).signature(DB_PRIMARY, DB_REPLICA)`.

## The takeaway

Three things the transformer writes for you, all fully checked/equivalent by
hand:

1. The string token (derived from the interface type).
2. The constructor-dependency metadata (`defineDeps(...)`).
3. The config bind schema -- and unlike 1 and 2, this one is STILL type-safe
   without the plugin, because `SchemaFor<T>` checks it structurally against
   the interface at compile time. Everything downstream (registration,
   resolution, scopes, lifetimes) is identical to the with-transformer path.

## Run it

Not runnable yet -- `@fnioc/config` doesn't exist. Once it does:

```sh
npm run build   # plain tsc, no transformer
npm run start   # run it
```
