# @fnioc/config-json

JSON file configuration provider for `@fnioc/config` — `JsonConfigurationSource`/
`JsonConfigurationProvider` plus the `addJsonFile` sugar bolted onto
`ConfigurationBuilder`. Mirrors `Microsoft.Extensions.Configuration.Json`'s
`AddJsonFile` extension method.

## Install

```sh
npm install @fnioc/config @fnioc/config-json
```

`@fnioc/config` is a peer dependency — install it alongside this package.

## Basic usage

```ts
import "@fnioc/config-json"; // unlocks .addJsonFile() on ConfigurationBuilder
import { ConfigurationBuilder } from "@fnioc/config";

const config = new ConfigurationBuilder()
  .addJsonFile("appsettings.json")
  .addJsonFile("appsettings.local.json", { optional: true })
  .build();

config.get("Server:Port");
```

`optional: true` makes a missing file resolve to an empty provider instead of
throwing. Malformed JSON in a file that *does* exist always throws, regardless
of `optional` — it only covers file absence, not file validity.

## The side-effect import requirement

`addJsonFile` isn't a method `ConfigurationBuilder` ships with — this package
bolts it on via TypeScript declaration merging + a runtime prototype patch,
the same shape as a C# extension method. If your code calls `.addJsonFile()`
but never names any other symbol from `@fnioc/config-json` (no
`JsonConfigurationSource`, no `JsonConfigurationProvider`), a bundler or
tree-shaker has nothing forcing it to load this package's module — you must
import it for its side effect explicitly:

```ts
import "@fnioc/config-json"; // unlocks .addJsonFile() on ConfigurationBuilder
```

This mirrors C#'s `using Microsoft.Extensions.Configuration.Json;` — that
`using` doesn't reference a type either, it just brings the extension method
into scope.
