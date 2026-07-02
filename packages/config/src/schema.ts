// Compile-time-checked configuration schemas.
//
// SchemaFor<T> is the type-level "shape description" of an interface T that
// bindConfig (see bind.ts) walks at runtime to bind a flat ConfigurationRoot
// into a typed T. Because SchemaFor<T> is derived directly from T via
// mapped/conditional types, writing a schema literal that doesn't match T
// exactly (missing field, extra field, wrong primitive kind, or a missing
// `{ optional: ... }` wrapper on an optional field) is a compile error --
// the schema and the interface can never silently drift apart.
//
// This is verified (via `tsc --strict`) to catch: missing fields, extra
// fields, wrong-kind primitives, and un-wrapped optional fields, for both
// primitives and nested objects. It intentionally does not cover arrays or
// unions -- out of scope for this MVP.

type Prim<T> = [T] extends [boolean] ? "boolean"
  : [T] extends [string] ? "string"
  : [T] extends [number] ? "number"
  : never;

type IsOptional<T, K extends keyof T> = {} extends Pick<T, K> ? true : false;

/**
 * The schema shape that exactly matches interface `T`, field for field.
 *
 * Write a `SchemaFor<T>` literal by hand and pass it to {@link bindConfig}
 * to bind a `ConfigurationRoot` into a typed `T` -- and get a compile error
 * from `tsc` the moment the literal drifts from `T`: a missing field, an
 * extra field, the wrong primitive kind (`"string"` vs `"number"` vs
 * `"boolean"`), or an optional field that isn't wrapped in `{ optional:
 * ... }` are all rejected before the code ever runs.
 *
 * Primitives map to their kind name (`boolean` -> `"boolean"`, etc.);
 * objects map to an object of `SchemaFor<...>` per property, with optional
 * properties (`T[K]` including `undefined`) required to be wrapped as
 * `{ optional: SchemaFor<...> }`. Arrays and unions are intentionally out
 * of scope for this MVP.
 *
 * @example
 * ```ts
 * interface ServerConfig {
 *   readonly host: string;
 *   readonly port: number;
 *   readonly ssl?: boolean;
 * }
 *
 * const schema: SchemaFor<ServerConfig> = {
 *   host: "string",
 *   port: "number",
 *   ssl: { optional: "boolean" },
 * };
 * ```
 */
export type SchemaFor<T> = [T] extends [boolean | string | number] ? Prim<T>
  : [T] extends [object] ? {
      [K in keyof T]-?: IsOptional<T, K> extends true
        ? { optional: SchemaFor<Required<T>[K]> }
        : SchemaFor<T[K]>;
    }
  : never;

/**
 * The untyped shape a {@link SchemaFor} value erases to at the type level --
 * a primitive-kind string, an `{ optional: Schema }` wrapper, or a nested
 * object of `Schema` values. `bindConfig` and its internals operate on this
 * looser type so they don't need to be generic over every possible `T`.
 *
 * Also usable directly by greenfield callers who'd rather write a schema
 * value first and derive its bound type from it via {@link Infer}, instead
 * of hand-writing an interface and a `SchemaFor<T>` literal that must match
 * it field for field.
 */
export type Schema = "string" | "number" | "boolean" | { optional: Schema } | { [k: string]: Schema };

/**
 * Type-level inverse of {@link SchemaFor}: derives the bound value's type
 * from a `Schema` value, rather than checking a schema literal against an
 * already-declared interface. `{ optional: S }` maps to `Infer<S> |
 * undefined`, matching what `bindConfig` actually produces for a
 * present-vs-absent optional field.
 *
 * @example
 * ```ts
 * const schema = { host: "string", port: "number" } as const satisfies Schema;
 * type Config = Infer<typeof schema>; // { host: string; port: number }
 * ```
 */
export type Infer<S> =
  S extends "string" ? string : S extends "number" ? number :
  S extends "boolean" ? boolean :
  S extends { optional: infer I } ? Infer<I> | undefined :
  S extends object ? { [K in keyof S]: Infer<S[K]> } : never;
