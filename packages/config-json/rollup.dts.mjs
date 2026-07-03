// Rolls the public type surface of @fnconfig/json into a single
// dist/index.d.ts. `@fnconfig/config` stays EXTERNAL (respectExternal: true) --
// this package's `declare module "@fnconfig/config"` augmentation must survive
// as a real module augmentation against the peer's published types, not get
// inlined into a private copy the consumer never touches.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { dts } from "rollup-plugin-dts";

const PKG_ROOT = dirname(fileURLToPath(import.meta.url));

export default {
  input: join(PKG_ROOT, "src", "index.ts"),
  output: { file: join(PKG_ROOT, "dist", "index.d.ts"), format: "es" },
  external: [/^@fnconfig\/config$/, /^@fnconfig\/core$/],
  plugins: [
    dts({
      tsconfig: join(PKG_ROOT, "tsconfig.json"),
      respectExternal: true,
    }),
  ],
};
