// Build @fnconfig/config for publication.
//
// This repo standardized on `moduleResolution: bundler` + extensionless
// relative imports (see /tsconfig.base.json). A plain `tsc` emit would leave
// those specifiers extensionless in dist/, which plain Node ESM cannot
// resolve — so every published package bundles instead:
//
//   1. dist/index.js   — `bun build` bundles the ESM entry into a single file
//      with resolved specifiers. config has no workspace deps and no real
//      runtime deps, so nothing is externalized.
//   2. dist/index.d.ts — rollup-plugin-dts rolls the public type surface into
//      one declaration file.

import { buildPackage } from "../../scripts/build-package";

await buildPackage({
  name: "@fnconfig/config",
  pkgRoot: import.meta.dir,
  emitJs: true,
});
