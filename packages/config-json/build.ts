// Build @fnconfig/json for publication.
//
// @fnconfig/config stays EXTERNAL: the addJsonFile augmentation patches the
// CONSUMER's ConfigurationBuilder.prototype, so a private inlined copy would
// leave the sugar method installed on a class the consumer never touches.

import { buildPackage } from "../../scripts/build-package";

await buildPackage({
  dir: import.meta.dir,
  name: "@fnconfig/json",
  external: ["@fnconfig/config", "@fnconfig/core"],
});
