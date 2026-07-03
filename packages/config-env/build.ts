// Build @fnconfig/env for publication.
//
// @fnconfig/config is a peer dependency and MUST stay external in both outputs --
// this package patches ConfigurationBuilder.prototype from @fnconfig/config, so a
// consumer's copy of @fnconfig/config must be the same instance the augmentation
// runs against. Bundling a private copy in (the pattern @fnioc/di uses for its
// inlined private @fnioc/core) would silently break addEnvironmentVariables.
//
//   1. dist/index.js   — `bun build` bundles the ESM entry, @fnconfig/config external.
//   2. dist/index.d.ts — rollup-plugin-dts rolls the public type surface into
//      one declaration file, @fnconfig/config external (respectExternal: true).

import { rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const PKG_ROOT = import.meta.dir;
const DIST = join(PKG_ROOT, "dist");
const ENTRY = join(PKG_ROOT, "src", "index.ts");

rmSync(DIST, { recursive: true, force: true });

// 1. JS bundle — ESM, node target, @fnconfig/config external.
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
  throw new Error("@fnconfig/env: bun build failed");
}

// 2. Rolled-up .d.ts — @fnconfig/config external.
const dts = spawnSync(
  "bun",
  ["x", "rollup", "-c", join(PKG_ROOT, "rollup.dts.mjs")],
  { cwd: PKG_ROOT, stdio: "inherit" },
);
if (dts.status !== 0) {
  throw new Error("@fnconfig/env: rollup d.ts bundling failed");
}
