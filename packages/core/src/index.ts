// Public entry point for @fnconfig/core -- the PURE-TYPES configuration
// abstractions substrate.
//
// Ships ZERO runtime values: only the IConfiguration* interfaces and the
// ITryGetResult tuple type. Engine consumers (@fnconfig/config) and provider
// packages depend on these via `import type` without pulling any runtime.

export type * from "./interfaces";
