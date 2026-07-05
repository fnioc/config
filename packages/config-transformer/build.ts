// Build @fnconfig/transformer for publication.
//
// `typescript` stays EXTERNAL (it's a peer dep — ts-patch supplies the same
// TypeScript instance at runtime). src/ imports nothing from @fnconfig/*, so
// the runtime bundle must be @fnconfig-free: the ONLY @fnconfig reference is the
// literal "@fnconfig/config" string the transformer emits as the injected
// import specifier (codegen, not an ESM import). We assert that no actual
// `import … from "@fnconfig/…"` slips into the transformer's own runtime.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildPackage } from "../../scripts/build-package";

await buildPackage({
  dir: import.meta.dir,
  name: "@fnconfig/transformer",
  external: ["typescript"],
});

// Guard: the emitted bundle must carry no real ESM import from @fnconfig/*.
// The literal "@fnconfig/config" (the injected import-specifier string) is
// expected and fine; an actual `import … from "@fnconfig/…"` is not.
const bundle = readFileSync(join(import.meta.dir, "dist", "index.js"), "utf8");
const realImport = /(^|\n)\s*import[^\n]*from\s*["']@fnconfig\//;
if (realImport.test(bundle)) {
  throw new Error(
    "@fnconfig/transformer: dist/index.js contains a real ESM import from @fnconfig/* — "
      + "the runtime bundle must be @fnconfig-free (the only @fnconfig reference is the "
      + "injected import-specifier string).",
  );
}
