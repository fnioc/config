// Build @fnioc/config for publication.
//
// This repo standardized on `moduleResolution: bundler` + extensionless
// relative imports (see /tsconfig.base.json). A plain `tsc` emit would leave
// those specifiers extensionless in dist/, which plain Node ESM cannot
// resolve — so every published package bundles instead:
//
//   1. dist/index.js   — `bun build` bundles the ESM entry into a single file
//      with resolved specifiers. Core has no workspace deps and no real
//      runtime deps, so nothing is externalized.
//   2. dist/index.d.ts — rollup-plugin-dts rolls the public type surface into
//      one declaration file.

import { rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const PKG_ROOT = import.meta.dir;
const DIST = join(PKG_ROOT, "dist");
const ENTRY = join(PKG_ROOT, "src", "index.ts");

rmSync(DIST, { recursive: true, force: true });

// 1. JS bundle — ESM, node target. Nothing external: core has no workspace or
// real runtime deps to keep out.
const js = await Bun.build({
  entrypoints: [ENTRY],
  outdir: DIST,
  target: "node",
  format: "esm",
});
if (!js.success) {
  for (const log of js.logs) {
    console.error(log);
  }
  throw new Error("@fnioc/config: bun build failed");
}

// 2. Rolled-up .d.ts — the whole public type surface in one file.
const dts = spawnSync(
  "bun",
  ["x", "rollup", "-c", join(PKG_ROOT, "rollup.dts.mjs")],
  { cwd: PKG_ROOT, stdio: "inherit" },
);
if (dts.status !== 0) {
  throw new Error("@fnioc/config: rollup d.ts bundling failed");
}
