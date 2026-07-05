// @fnconfig/transformer -- the @fnconfig ts-patch compiler transformer.
//
// Build-time only. It rewrites `.withType<T>()` on a `ConfigurationBuilder` into
// a generated `.withSchema({...})` runtime schema literal at compile time, so a
// plain interface yields fully-typed, fully-coerced configuration with zero
// hand-written schema. The runtime (`@fnconfig/config`) does all coercion; this
// package only synthesizes the schema literal.
//
// Consumer tsconfig plugin form:
//
// ```jsonc
// { "compilerOptions": { "plugins": [
//   { "transform": "@fnconfig/transformer", "import": "transform" }
// ] } }
// ```

// ts-patch entry point (default + named `transform`) and the test-drivable
// factory.
export {
  transform,
  default as transformer,
  createTransformerFactory,
} from "./transformer.js";

// Diagnostic surface -- exported so downstream tooling (and tests) can assert on
// stable codes without matching message text.
export {
  DiagnosticCode,
  type Diagnostic,
  type DiagnosticSink,
} from "./diagnostics.js";
