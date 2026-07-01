// Public entry point for @fnioc/config.
//
// Re-exports everything a consumer needs to build a layered configuration
// (JSON/env/CLI sources -> ConfigBuilder), describe its shape at the type
// level (SchemaFor<T> / Schema / Infer), and bind it into a typed value
// (bindConfig) for constructor injection via @fnioc/di. No build step or
// transformer is required for any of this -- everything here is usable by
// hand. Each symbol's full JSDoc lives on its original declaration (hover
// follows through this re-export); the groupings below are just a map of
// what lives where.

/** Compose {@link ConfigSource}s into a merged {@link ConfigurationRoot}. */
export { ConfigBuilder } from "./config-builder.js";

/** The merged configuration view, and the contract a custom source implements. */
export { ConfigurationRoot } from "./sources/types.js";
export type { ConfigSource } from "./sources/types.js";

/** Bind a {@link ConfigurationRoot} into a typed value, per a {@link SchemaFor}. */
export { bindConfig, ConfigBindError } from "./bind.js";
export type { BindOptions } from "./bind.js";

/** Type-level schema description: derive a schema from `T`, or `T` from a schema. */
export type { Infer, Schema, SchemaFor } from "./schema.js";

/** Built-in `ConfigSource`s: JSON file, `process.env`, and CLI argv. */
export { JsonFileSource } from "./sources/json-file.js";
export type { JsonFileSourceOptions } from "./sources/json-file.js";

export { EnvironmentVariablesSource } from "./sources/environment-variables.js";

export { CommandLineSource } from "./sources/command-line.js";
export type { CommandLineSourceOptions } from "./sources/command-line.js";
