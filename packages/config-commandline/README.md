# @fnconfig/commandline

Command-line configuration provider for `@fnconfig/config` —
`CommandLineConfigurationSource`/`CommandLineConfigurationProvider` plus the
`addCommandLine` sugar bolted onto `ConfigurationBuilder`. Mirrors
`Microsoft.Extensions.Configuration.CommandLine`'s `AddCommandLine` extension
method.

## Install

```sh
npm install @fnconfig/config @fnconfig/commandline
```

`@fnconfig/config` is a peer dependency — install it alongside this package.

## Basic usage

```ts
import "@fnconfig/commandline"; // unlocks .addCommandLine() on ConfigurationBuilder
import { ConfigurationBuilder } from "@fnconfig/config";

const config = new ConfigurationBuilder()
  .addCommandLine(process.argv.slice(2), { "-p": "Server:Port" })
  .build();

// `node app.js --Server:Port=8080` or `node app.js -p 8080`
config.get("Server:Port"); // "8080"
```

`switchMappings` keys are validated at construction time: every key must
start with `-`, and two keys differing only by case collide and throw.
Unlike Microsoft's own provider, this one fails loudly (throws) on an
unmapped short switch or a switch missing its trailing value, rather than
silently dropping it — a CLI source should error on unparseable input, not
silently drop config.

## The side-effect import requirement

`addCommandLine` isn't a method `ConfigurationBuilder` ships with — this
package bolts it on via TypeScript declaration merging + a runtime prototype
patch, the same shape as a C# extension method. If your code calls
`.addCommandLine()` but never names any other symbol from
`@fnconfig/commandline`, a bundler or tree-shaker has nothing forcing it
to load this package's module — you must import it for its side effect
explicitly:

```ts
import "@fnconfig/commandline"; // unlocks .addCommandLine() on ConfigurationBuilder
```

This mirrors C#'s `using Microsoft.Extensions.Configuration.CommandLine;` —
that `using` doesn't reference a type either, it just brings the extension
method into scope.
