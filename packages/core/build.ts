// Build @fnconfig/core for publication.
//
// core is a PURE-TYPES package -- it ships ZERO runtime. The only artifact is a
// single self-contained declaration file:
//
//   dist/index.d.ts -- rollup-plugin-dts rolls core's public type surface into
//   one .d.ts. The interfaces have no imports, so the published declaration has
//   no external import and core carries no dependencies.
//
// There is deliberately NO dist/index.js -- nothing imports core at runtime
// (every consumer uses `import type`), so emitting one would contradict the
// zero-runtime invariant buildPackage() asserts below (emitJs: false).

import { buildPackage } from "../../scripts/build-package";

await buildPackage({
  name: "@fnconfig/core",
  pkgRoot: import.meta.dir,
  emitJs: false,
});
