// Rolls the public type surface of @fnconfig/transformer into a single
// dist/index.d.ts. `typescript` stays EXTERNAL (respectExternal: true) -- it's
// a peer dependency, not something to inline into the declaration output.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { dts } from "rollup-plugin-dts";

const PKG_ROOT = dirname(fileURLToPath(import.meta.url));

export default {
  input: join(PKG_ROOT, "src", "index.ts"),
  output: { file: join(PKG_ROOT, "dist", "index.d.ts"), format: "es" },
  external: [/^typescript$/],
  plugins: [
    dts({
      tsconfig: join(PKG_ROOT, "tsconfig.json"),
      respectExternal: true,
    }),
  ],
};
