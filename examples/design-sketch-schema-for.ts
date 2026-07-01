// DESIGN SKETCH -- not part of either example, not shippable as-is. This is
// the actual mechanism behind `SchemaFor<T>` referenced throughout both
// examples' main.ts/README, written out concretely so it's reviewable rather
// than just described in prose. Covers primitives + nested objects + the
// `optional` wrapper; unions/arrays/index signatures would need more cases.
//
// The core insight: TypeScript erases generic type params at RUNTIME, but
// `addConfig<T>(root, schema)`'s call site is checked at COMPILE time, where
// the checker has full static knowledge of T. No value of type T is ever
// passed in this API -- so erasure never actually bites. Checking a
// hand-written schema LITERAL against a type derived from T is just an
// ordinary structural type check, same as any other TS assignability check.

type Prim<T> = [T] extends [boolean] ? "boolean"
  : [T] extends [string] ? "string"
  : [T] extends [number] ? "number"
  : never;

type IsOptional<T, K extends keyof T> = {} extends Pick<T, K> ? true : false;

export type SchemaFor<T> = [T] extends [boolean | string | number] ? Prim<T>
  : [T] extends [object] ? {
      [K in keyof T]-?: IsOptional<T, K> extends true
        ? { optional: SchemaFor<Required<T>[K]> }
        : SchemaFor<T[K]>;
    }
  : never;

// ── usage against the example's actual contracts ─────────────────────────────

interface ServerConfig {
  readonly host: string;
  readonly port: number;
  readonly ssl?: boolean;
}

// Compiles: every key present, no extras, kinds match, `ssl` wrapped in
// `{ optional: ... }` because it's optional on ServerConfig.
const ok: SchemaFor<ServerConfig> = {
  host: "string",
  port: "number",
  ssl: { optional: "boolean" },
};
void ok;

// Each of these fails to compile -- uncomment any one to see the error:
//
// const missingKey: SchemaFor<ServerConfig> = { host: "string", ssl: { optional: "boolean" } };
//   // Property 'port' is missing in type '{ host: "string"; ssl: {...} }'.
//
// const extraKey: SchemaFor<ServerConfig> = { host: "string", port: "number", ssl: { optional: "boolean" }, extra: "string" };
//   // Object literal may only specify known properties, and 'extra' does not exist in type 'SchemaFor<ServerConfig>'.
//
// const wrongKind: SchemaFor<ServerConfig> = { host: "string", port: "string", ssl: { optional: "boolean" } };
//   // Type '"string"' is not assignable to type '"number"'.
//
// const unwrappedOptional: SchemaFor<ServerConfig> = { host: "string", port: "number", ssl: "boolean" };
//   // Type '"boolean"' is not assignable to type '{ optional: "boolean"; }'.
