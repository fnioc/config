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

import { rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const PKG_ROOT = import.meta.dir;
const DIST = join(PKG_ROOT, "dist");
const ENTRY = join(PKG_ROOT, "src", "index.ts");

rmSync(DIST, { recursive: true, force: true });

// 1. JS bundle -- ESM, node target, @fnconfig/config external.
const js = await Bun.build({
  entrypoints: [ENTRY],
  outdir: DIST,
  target: "node",
  format: "esm",
  external: ["@fnconfig/config", "@fnconfig/core"],
});
if (!js.success) {
  for (const log of js.logs) {
    console.error(log);
  }
  throw new Error("@fnconfig/commandline: bun build failed");
}

// 2. Rolled-up .d.ts -- @fnconfig/config external.
const dts = spawnSync(
  "bun",
  ["x", "rollup", "-c", join(PKG_ROOT, "rollup.dts.mjs")],
  { cwd: PKG_ROOT, stdio: "inherit" },
);
if (dts.status !== 0) {
  throw new Error("@fnconfig/commandline: rollup d.ts bundling failed");
}
