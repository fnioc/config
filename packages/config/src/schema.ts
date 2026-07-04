// Compile-time-checked configuration schemas.
//
// SchemaFor<T> is the type-level "shape description" of an interface T that
// bindConfig (see bind.ts) walks at runtime to bind a flat ConfigurationRoot
// into a typed T. Because SchemaFor<T> is derived directly from T via
// mapped/conditional types, writing a schema literal that doesn't match T
// exactly (missing field, extra field, wrong primitive kind, or a missing
// optional wrapper on an optional field) is a compile error -- the schema and
// the interface can never silently drift apart.
//
// An optional field is marked by wrapping its schema with `optional(...)`,
// which boxes it under the `optionalMarker` symbol key. The marker is a
// `unique symbol`, NOT the string "optional", so it can never be confused with
// a real interface property that happens to be named `optional`:
// `SchemaFor<{ optional: string }>` is `{ optional: "string" }` (a plain string
// key) -- categorically distinct from the symbol-keyed wrapper the binder
// looks for. That out-of-band discriminator is what lets bind.ts narrow the
// wrapper by type rather than by an ambiguous key-name check.
//
// This is verified (via `tsc --strict`) to catch: missing fields, extra
// fields, wrong-kind primitives, and un-wrapped optional fields, for both
// primitives and nested objects. It intentionally does not cover arrays or
// unions -- out of scope for this MVP.

/**
 * The out-of-band discriminator that marks an optional-field wrapper in a
 * schema. An optional field's schema is `{ [optionalMarker]: <inner> }`.
 *
 * Because the key is a `unique symbol` -- not the string `"optional"` -- it can
 * never collide with a real interface property. `SchemaFor<{ optional: string }>`
 * (an interface whose property is literally *named* `optional`) produces
 * `{ optional: "string" }` with a plain string key, which the binder can tell
 * apart from this symbol-keyed wrapper. Prefer the {@link optional} helper for
 * hand-authoring rather than writing the computed key directly.
 */
export const optionalMarker: unique symbol = Symbol("@fnconfig/config:optional");

type Prim<T> = [T] extends [boolean] ? "boolean"
  : [T] extends [string] ? "string"
  : [T] extends [number] ? "number"
  : never;

/** A primitive-kind schema leaf. */
export type LeafSchema = "string" | "number" | "boolean";

/**
 * A nested-object schema: each property name maps to that property's child
 * `Schema`. Optional child fields are represented by the {@link OptionalSchema}
 * wrapper as the property value.
 */
export interface ObjectSchema {
  readonly [key: string]: Schema;
}

/**
 * The optional-field wrapper: the {@link optionalMarker} symbol keyed to the
 * schema the field takes *when present*. The inner is a {@link RequiredSchema}
 * -- a field is never wrapped as optional twice.
 */
export interface OptionalSchema {
  readonly [optionalMarker]: RequiredSchema;
}

/** A schema that is not itself an optional wrapper -- a leaf or a nested object. */
export type RequiredSchema = LeafSchema | ObjectSchema;

/**
 * The untyped shape a {@link SchemaFor} value erases to at the type level -- a
 * primitive-kind string, an `{ [optionalMarker]: Schema }` wrapper, or a nested
 * object of `Schema` values. `bindConfig` and its internals operate on this
 * looser type so they don't need to be generic over every possible `T`.
 *
 * Also usable directly by greenfield callers who'd rather write a schema value
 * first and derive its bound type from it via {@link Infer}, instead of
 * hand-writing an interface and a `SchemaFor<T>` literal that must match it
 * field for field.
 */
export type Schema = RequiredSchema | OptionalSchema;

type IsOptional<T, K extends keyof T> = {} extends Pick<T, K> ? true : false;

/**
 * The schema shape that exactly matches interface `T`, field for field.
 *
 * Write a `SchemaFor<T>` literal by hand and pass it to {@link bindConfig} to
 * bind a `ConfigurationRoot` into a typed `T` -- and get a compile error from
 * `tsc` the moment the literal drifts from `T`: a missing field, an extra
 * field, the wrong primitive kind (`"string"` vs `"number"` vs `"boolean"`), or
 * an optional field that isn't wrapped with {@link optional} are all rejected
 * before the code ever runs.
 *
 * Primitives map to their kind name (`boolean` -> `"boolean"`, etc.); objects
 * map to an object of `SchemaFor<...>` per property, with optional properties
 * (`T[K]` including `undefined`) required to be wrapped as `optional(...)`.
 * Arrays and unions are intentionally out of scope for this MVP.
 *
 * @example
 * ```ts
 * import { optional, type SchemaFor } from "@fnconfig/config";
 *
 * interface ServerConfig {
 *   readonly host: string;
 *   readonly port: number;
 *   readonly ssl?: boolean;
 * }
 *
 * const schema: SchemaFor<ServerConfig> = {
 *   host: "string",
 *   port: "number",
 *   ssl: optional("boolean"),
 * };
 * ```
 */
export type SchemaFor<T> = [T] extends [boolean | string | number] ? Prim<T>
  : [T] extends [object] ? {
      [K in keyof T]-?: IsOptional<T, K> extends true
        ? { readonly [optionalMarker]: SchemaFor<Required<T>[K]> }
        : SchemaFor<T[K]>;
    }
  : never;

/**
 * Wraps an inner schema as an optional-field marker for a hand-authored
 * schema: `optional("number")` is the value `SchemaFor<T>` expects for an
 * optional field like `timeout?: number`. Boxes `inner` under the
 * {@link optionalMarker} symbol so the binder recognizes it out-of-band,
 * never by a colliding property name.
 *
 * @example
 * ```ts
 * const schema: SchemaFor<{ timeout?: number }> = { timeout: optional("number") };
 * ```
 */
export function optional<const S extends RequiredSchema>(inner: S): { readonly [optionalMarker]: S } {
  return { [optionalMarker]: inner };
}

/**
 * Type-level inverse of {@link SchemaFor}: derives the bound value's type from
 * a `Schema` value, rather than checking a schema literal against an
 * already-declared interface. An `{ [optionalMarker]: S }` wrapper maps to
 * `Infer<S> | undefined`, matching what `bindConfig` actually produces for a
 * present-vs-absent optional field.
 *
 * @example
 * ```ts
 * const schema = { host: "string", port: "number" } as const satisfies Schema;
 * type Config = Infer<typeof schema>; // { host: string; port: number }
 * ```
 */
export type Infer<S> = S extends "string" ? string
  : S extends "number" ? number
  : S extends "boolean" ? boolean
  : S extends { readonly [optionalMarker]: infer I } ? Infer<I> | undefined
  : S extends object ? { [K in keyof S]: Infer<S[K]> }
  : never;
