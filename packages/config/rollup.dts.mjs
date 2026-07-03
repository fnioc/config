// Rolls the public type surface of @fnconfig/config into a single dist/index.d.ts.
// @fnconfig/core stays EXTERNAL (respectExternal) so the published declaration
// imports the IConfiguration* types from @fnconfig/core rather than inlining a
// private copy; rollup-plugin-dts drives the TypeScript compiler with this
// package's tsconfig, so extensionless relative specifiers resolve through
// `moduleResolution: bundler`.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { dts } from "rollup-plugin-dts";

const PKG_ROOT = dirname(fileURLToPath(import.meta.url));

export default {
  input: join(PKG_ROOT, "src", "index.ts"),
  output: { file: join(PKG_ROOT, "dist", "index.d.ts"), format: "es" },
  external: [/^@fnconfig\/core$/],
  plugins: [
    dts({
      tsconfig: join(PKG_ROOT, "tsconfig.json"),
      respectExternal: true,
    }),
  ],
};
