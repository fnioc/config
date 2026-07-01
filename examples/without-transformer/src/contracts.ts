// The SAME contracts as ../../with-transformer/src/contracts.ts. Nothing
// about these interfaces changes without the transformer -- they are plain
// TypeScript either way. What changes is how they get bound and wired (see
// main.ts): tokens and dependency metadata are written by hand instead of
// derived, and the config schema is written by hand instead of generated --
// but still fully type-checked against these shapes (see SchemaFor<T> usage
// in main.ts).

export interface ServerConfig {
  readonly host: string;
  readonly port: number;
  readonly ssl?: boolean;
}

export interface DatabaseConfig {
  readonly host: string;
  readonly database: string;
  readonly poolSize: number;
}
