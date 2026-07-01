# @fnioc/config -- example sketches (design review, not yet buildable)

Two proposed apps demonstrating `@fnioc/config`, layered on top of
[`@fnioc/di`](https://github.com/fnioc/ioc). Neither builds yet --
`@fnioc/config` doesn't exist as a package. This is the API/DX proposed
BEFORE any real implementation starts, mirroring ioc's own
`examples/with-transformer` + `examples/without-transformer` pattern.

Both apps wire the same thing: an `ApiServer` bound from a `Server` config
section, and a `DatabasePool` bound from TWO named instances of the same
`DatabaseConfig` shape (`Database:Primary` / `Database:Replica`), all sourced
from a JSON base file + an optional per-environment JSON overlay + env vars +
CLI args, layered last-source-wins-per-key.

| Example | Authoring | Build | Notable |
| --- | --- | --- | --- |
| [`with-transformer`](./with-transformer) | type-driven: `addConfig<ServerConfig>(root)`, no schema, no token | `tspc` (`@fnioc/config`'s own ts-patch plugin, chained with `@fnioc/transformer`) | `Inject<T,"tok">` reused for named instances |
| [`without-transformer`](./without-transformer) | plugin-less: explicit tokens + hand-written `defineDeps`-equivalent + hand-written **`SchemaFor<T>`-checked** bind schema | plain `tsc` | Full compile-time schema safety with ZERO plugin |

## The core design decisions (see each example's README for detail)

1. **Constructor injection needs nothing new.** `ApiServer(config: ServerConfig)`
   is 100% ordinary DI -- a plain named interface tokenizes exactly like any
   other Rule-1 type today. The only thing that decides "this resolves to
   bound configuration" is which REGISTRATION method was used (`addConfig` vs
   `add`), never the ctor param's annotation.
2. **No separate Options tiers.** Freshness is just whatever scope you
   resolve in -- fnioc's scopes already subsume .NET's
   `IOptions`/`IOptionsSnapshot`/`IOptionsMonitor` distinction.
3. **Named instances reuse the EXISTING `Inject<T,"tok">` brand** -- no new
   "named options" mechanism, matching how `addConfig` gets an explicit-token
   overload exactly like `add(token, C)` already has.
4. **Layered sources, not deep merge -- a behavioral analogue of
   Microsoft.Extensions.Configuration (MEC), not a literal port.** Each source
   (JSON/env/CLI) flattens independently to a colon-delimited flat map; lookup
   walks providers back-to-front at READ time (never eagerly pre-merged at
   `.build()`, matching `IConfigurationRoot`'s real behavior), LAST-registered
   source winning PER KEY. Key matching is case-INSENSITIVE throughout (MEC
   does this too) -- an env var `APP_SERVER__HOST` is stored as `SERVER:HOST`
   verbatim, not re-cased to `Server:Host`; it still binds to a `host` field
   because lookups ignore case, not because of any normalization step.
   Deliberately NOT modeled: MEC's `AddJsonFile(reloadOnChange:)` (folded into
   the deferred live-reload design,
   [fnioc/config#1](https://github.com/fnioc/config/issues/1)) and MEC's
   `/key value` slash-prefixed CLI switches (a Windows/cmd.exe convention with
   no Node-ecosystem expectation).
5. **The plugin-less path is fully type-safe, not a degraded fallback.**
   `SchemaFor<T>` (a plain exported mapped type, no codegen involved) checks
   a hand-written bind schema against the interface's actual shape at compile
   time -- missing/extra/wrong-kind keys are compile errors either way. The
   transformer's entire value-add is not having to write that schema by
   hand -- everything about its CORRECTNESS already holds without it.

## Still open (not resolved by these sketches)

- Live-reload / config monitoring -- deliberately deferred, tracked at
  [fnioc/config#1](https://github.com/fnioc/config/issues/1).
- Whether `@fnioc/config` ships as one package (assumed here) or splits into
  a runtime package + a transformer package, mirroring `@fnioc/di` +
  `@fnioc/transformer` (so plain runtime consumers don't need `typescript` as
  a dependency).
- CLI switch-mapping / env-var-prefix exact syntax is illustrative here, not
  finalized.

## The takeaway

Same as ioc's own examples: the transformer removes boilerplate the manual
example writes by hand (token derivation, `defineDeps`, and now the bind
schema too) -- but for `@fnioc/config` specifically, the manual path is not a
*lesser* path. `SchemaFor<T>` means the hand-written schema is exactly as
safe as the generated one. Everything downstream -- registration, scopes,
lifetimes, resolution -- is identical either way.
