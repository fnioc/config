// Shared publication-build helper for every @fnconfig/* package.
//
// This repo standardized on `moduleResolution: bundler` + extensionless
// relative imports (see /tsconfig.base.json). A plain `tsc` emit would leave
// those specifiers extensionless in dist/, which plain Node ESM cannot
// resolve -- so every published package bundles instead:
//
//   1. dist/index.js   -- `bun build` bundles the ESM entry into a single
//      file with resolved specifiers. Packages that peer-depend on another
//      @fnconfig/* package keep that dependency EXTERNAL (see each package's
//      own build.ts for which): the augmentation pattern (addJsonFile,
//      addEnvironmentVariables, addCommandLine, ...) patches
//      ConfigurationBuilder.prototype from the CONSUMER's own copy of
//      @fnconfig/config, so bundling a private copy in would leave the sugar
//      method installed on a class the consumer never touches.
//   2. dist/index.d.ts -- rollup-plugin-dts rolls the public type surface
//      into one declaration file, honoring the same externals
//      (respectExternal: true in each package's rollup.dts.mjs).
//
// core is the one exception: it is a PURE-TYPES package that ships ZERO
// runtime, so it skips step 1 entirely (emitJs: false) and this helper
// instead asserts that no dist/index.js was produced.
//
// Each package's build.ts calls buildPackage() passing its OWN
// `import.meta.dir` as pkgRoot -- this module can't compute that path
// itself, since import.meta.dir from in here would resolve to scripts/,
// not the calling package's directory.

import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

export interface BuildPackageOptions {
  /** Published package name, e.g. "@fnconfig/config" -- used in error messages. */
  name: string;
  /** Absolute path to the package root. Pass the CALLER's `import.meta.dir`. */
  pkgRoot: string;
  /** Whether to emit a JS bundle. core sets this to false (types-only, zero runtime). */
  emitJs: boolean;
  /** Workspace/peer deps to keep external in the JS bundle. Ignored when emitJs is false. */
  external?: string[];
}

export async function buildPackage(options: BuildPackageOptions): Promise<void> {
  const { name, pkgRoot, emitJs, external = [] } = options;
  const dist = join(pkgRoot, "dist");

  rmSync(dist, { recursive: true, force: true });

  if (emitJs) {
    const js = await Bun.build({
      entrypoints: [join(pkgRoot, "src", "index.ts")],
      outdir: dist,
      target: "node",
      format: "esm",
      external,
    });
    if (!js.success) {
      for (const log of js.logs) {
        console.error(log);
      }
      throw new Error(`${name}: bun build failed`);
    }
  }

  const dts = spawnSync(
    "bun",
    ["x", "rollup", "-c", join(pkgRoot, "rollup.dts.mjs")],
    { cwd: pkgRoot, stdio: "inherit" },
  );
  if (dts.status !== 0) {
    throw new Error(`${name}: rollup d.ts bundling failed`);
  }

  if (!emitJs && existsSync(join(dist, "index.js"))) {
    throw new Error(`${name}: unexpected runtime artifact dist/index.js -- ${name} is types-only`);
  }
}
