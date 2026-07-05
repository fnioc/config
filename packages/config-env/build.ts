// Build @fnconfig/env for publication.
//
// @fnconfig/config stays EXTERNAL: this package patches
// ConfigurationBuilder.prototype from @fnconfig/config, so a consumer's copy of
// @fnconfig/config must be the same instance the augmentation runs against.

import { buildPackage } from "../../scripts/build-package";

await buildPackage({
  dir: import.meta.dir,
  name: "@fnconfig/env",
  external: ["@fnconfig/config", "@fnconfig/core"],
});
