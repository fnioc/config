// Build @fnioc/config-env for publication.
//
// @fnioc/config is a peer dependency and MUST stay external in both outputs --
// this package patches ConfigurationBuilder.prototype from @fnioc/config, so a
// consumer's copy of @fnioc/config must be the same instance the augmentation
// runs against. Bundling a private copy in (the pattern @fnioc/di uses for its
// inlined private @fnioc/core) would silently break addEnvironmentVariables.
//
//   1. dist/index.js   — `bun build` bundles the ESM entry, @fnioc/config external.
//   2. dist/index.d.ts — rollup-plugin-dts rolls the public type surface into
//      one declaration file, @fnioc/config external (respectExternal: true).

import { rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const PKG_ROOT = import.meta.dir;
const DIST = join(PKG_ROOT, "dist");
const ENTRY = join(PKG_ROOT, "src", "index.ts");

rmSync(DIST, { recursive: true, force: true });

// 1. JS bundle — ESM, node target, @fnioc/config external.
const js = await Bun.build({
  entrypoints: [ENTRY],
  outdir: DIST,
  target: "node",
  format: "esm",
  external: ["@fnioc/config"],
});
if (!js.success) {
  for (const log of js.logs) {
    console.error(log);
  }
  throw new Error("@fnioc/config-env: bun build failed");
}

// 2. Rolled-up .d.ts — @fnioc/config external.
const dts = spawnSync(
  "bun",
  ["x", "rollup", "-c", join(PKG_ROOT, "rollup.dts.mjs")],
  { cwd: PKG_ROOT, stdio: "inherit" },
);
if (dts.status !== 0) {
  throw new Error("@fnioc/config-env: rollup d.ts bundling failed");
}
