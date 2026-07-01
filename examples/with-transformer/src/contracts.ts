// Interface-first contracts for the example app. These are app-internal
// types, so @fnioc/transformer derives source-relative tokens for them
// (`./contracts/ServerConfig`) -- no string token is ever written by hand.
// @fnioc/config's OWN transformer reuses that exact same token derivation
// (it imports @fnioc/transformer's `deriveToken`/`tokenForType`), so a plain
// ctor param of one of these shapes and an `addConfig<Shape>(...)`
// registration always agree on the token without either side naming it.

/** Bound from the "Server" section of the merged configuration. */
export interface ServerConfig {
  readonly host: string;
  readonly port: number;
  /** Optional -- absent in the base file, set false by the dev overlay. */
  readonly ssl?: boolean;
}

/**
 * Bound from "Database:Primary" / "Database:Replica" -- the SAME shape, two
 * independently-configured instances. See main.ts for how named instances
 * work (no new mechanism: the EXISTING `Inject<T,"tok">` brand + addConfig's
 * explicit-token overload, exactly like a second `add(token, C)` registration
 * of the same interface).
 */
export interface DatabaseConfig {
  readonly host: string;
  readonly database: string;
  readonly poolSize: number;
}

export interface IApiServer {
  describe(): string;
}

export interface IDatabasePool {
  describe(): string;
}
