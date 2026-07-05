// Rolls the Tier 2 opt-in seam (src/with-type-augment.ts) into a standalone
// dist/with-type-augment.d.ts. This module is NOT reachable from the barrel, so
// it needs its own roll -- otherwise the `withType` declaration would never
// reach a published consumer who imports "@fnconfig/config/with-type-augment".
//
// Both @fnconfig/core and the public subpath "@fnconfig/config/configuration-builder"
// stay EXTERNAL (respectExternal), so the emitted `declare module
// "@fnconfig/config/configuration-builder"` augmentation is preserved verbatim
// and merges onto the consumer's real ConfigurationBuilder.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { dts } from "rollup-plugin-dts";

const PKG_ROOT = dirname(fileURLToPath(import.meta.url));

export default {
  input: join(PKG_ROOT, "src", "with-type-augment.ts"),
  output: { file: join(PKG_ROOT, "dist", "with-type-augment.d.ts"), format: "es" },
  external: [/^@fnconfig\/core$/, /^@fnconfig\/config\/configuration-builder$/],
  plugins: [
    dts({
      tsconfig: join(PKG_ROOT, "tsconfig.json"),
      respectExternal: true,
    }),
  ],
};
