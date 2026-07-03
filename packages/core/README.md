# @fnconfig/core

Types-only configuration abstractions: the `IConfiguration*` interfaces
(`IConfiguration`, `IConfigurationBuilder`, `IConfigurationRoot`,
`IConfigurationSection`, `IConfigurationSource`, `IConfigurationProvider`,
`IConfigurationManager`) plus the `ITryGetResult` tuple type.

This package ships **zero runtime** — no JavaScript, only a `.d.ts` bundle.
`@fnconfig/config` and the provider packages (`@fnconfig/json`, `@fnconfig/env`,
`@fnconfig/commandline`) depend on it for shared interface types via `import
type`, so those types erase at compile time and never appear in any built
bundle.

## Install

You generally don't install this package directly — `@fnconfig/config`
re-exports every type it defines, and installing `@fnconfig/config` pulls it
in as a dependency automatically. Install it explicitly only if you're
writing a package that implements one of these interfaces (for example a
custom `IConfigurationSource`) without depending on `@fnconfig/config`
itself.

```sh
npm install @fnconfig/core
```

## Usage

```ts
import type { IConfiguration, IConfigurationSource } from "@fnconfig/core";

function readPort(config: IConfiguration): string | undefined {
  return config.get("Server:Port");
}
```
