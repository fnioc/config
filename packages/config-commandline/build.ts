// Build @fnconfig/commandline for publication.
//
// This repo standardized on `moduleResolution: bundler` + extensionless
// relative imports (see /tsconfig.base.json). A plain `tsc` emit would leave
// those specifiers extensionless in dist/, which plain Node ESM cannot
// resolve — so every published package bundles instead. `@fnconfig/config` stays
// EXTERNAL here (unlike ioc@fnioc's di-inlines-core pattern): the augmentation
// pattern patches `ConfigurationBuilder.prototype` from the CONSUMER's copy of
// @fnconfig/config, so bundling a private copy in would leave the sugar method
// installed on a class the consumer never touches -- see the plan's
// "critical constraint" callout.
//
//   1. dist/index.js   — `bun build` bundles the ESM entry, `@fnconfig/config`
//      external.
//   2. dist/index.d.ts — rollup-plugin-dts rolls the public type surface into
//      one declaration file, `@fnconfig/config` external (respectExternal: true).

import { buildPackage } from "../../scripts/build-package";

await buildPackage({
  name: "@fnconfig/commandline",
  pkgRoot: import.meta.dir,
  emitJs: true,
  external: ["@fnconfig/config", "@fnconfig/core"],
});
