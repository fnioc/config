// Build @fnconfig/env for publication.
//
// @fnconfig/config is a peer dependency and MUST stay external in both outputs --
// this package patches ConfigurationBuilder.prototype from @fnconfig/config, so a
// consumer's copy of @fnconfig/config must be the same instance the augmentation
// runs against. Bundling a private copy of @fnconfig/config in would silently
// break addEnvironmentVariables.
//
//   1. dist/index.js   — `bun build` bundles the ESM entry, @fnconfig/config external.
//   2. dist/index.d.ts — rollup-plugin-dts rolls the public type surface into
//      one declaration file, @fnconfig/config external (respectExternal: true).

import { buildPackage } from "../../scripts/build-package";

await buildPackage({
  name: "@fnconfig/env",
  pkgRoot: import.meta.dir,
  emitJs: true,
  external: ["@fnconfig/config", "@fnconfig/core"],
});
