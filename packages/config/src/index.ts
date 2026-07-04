// Public entry point for @fnconfig/config -- the faithful-port core engine.
//
// Exports the ported abstractions (IConfiguration* interfaces + the configPath
// helpers), the engine classes (ConfigurationBuilder / ConfigurationRoot /
// ConfigurationSection / the abstract ConfigurationProvider base /
// ConfigurationKeyComparer), the bundled Memory provider + its
// addInMemoryCollection augmentation, and the compile-time-checked schema
// binder. Provider packages (@fnconfig/json/-env/-commandline) peer-depend
// on this package, extend ConfigurationProvider, implement IConfigurationSource,
// and augment ConfigurationBuilder with their own add* sugar.

// The abstraction types (IConfiguration/-Builder/-Root/-Section/-Source/
// -Provider/-Manager + ITryGetResult) now live in @fnconfig/core. Re-export
// them so consumers importing them from @fnconfig/config keep working --
// config's public surface stays a superset of core's.
export type * from "@fnconfig/core";

// The runtime `configPath` helper namespace stays in this package.
export * from "./abstractions";

// Engine.
export { ConfigurationBuilder } from "./configuration-builder";
export { ConfigurationRoot } from "./configuration-root";
export { ConfigurationSection } from "./configuration-section";
export { ConfigurationProvider } from "./configuration-provider";
export { ConfigurationKeyComparer } from "./configuration-key-comparer";

// Memory provider. The re-export is side-effectful: importing this module
// installs the `addInMemoryCollection` prototype method + declaration merge
// onto ConfigurationBuilder.
export * from "./memory";

// Schema binder.
export { bindConfig, ConfigBindError } from "./bind";
export type { BindOptions } from "./bind";

// Type-level schema description: derive a schema from `T`, or `T` from a schema.
// `optional(...)` (and its underlying `optionalMarker` symbol) wraps a field's
// schema to mark it optional -- an out-of-band discriminator that never
// collides with a real property named `optional`.
export { optional, optionalMarker } from "./schema";
export type { Infer, Schema, SchemaFor } from "./schema";
