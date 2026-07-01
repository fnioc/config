// Concrete services for the example app. A `cfg: ServerConfig` ctor param is
// 100% ordinary DI -- @fnioc/config adds nothing new on the INJECTION side.
// The only special thing anywhere in this file is `DatabasePool` using the
// EXISTING `Inject<T,"tok">` brand to disambiguate two instances of the same
// shape (`DatabaseConfig`) -- see main.ts for the matching registrations.

import type { Inject } from "./fnioc-transformer.js";
import type { DatabaseConfig, IApiServer, IDatabasePool, ServerConfig } from "./contracts.js";

export class ApiServer implements IApiServer {
  public constructor(private readonly config: ServerConfig) {}

  public describe(): string {
    const tls = this.config.ssl ? " (tls)" : "";
    return `listening on ${this.config.host}:${this.config.port}${tls}`;
  }
}

/**
 * Depends on TWO instances of the SAME shape (`DatabaseConfig`). Since a
 * plain `DatabaseConfig` param would tokenize to the same thing twice, each
 * param is branded to the token its matching `addConfig` registration was
 * given explicitly in main.ts.
 */
export class DatabasePool implements IDatabasePool {
  public constructor(
    private readonly primary: Inject<DatabaseConfig, "cfg:db-primary">,
    private readonly replica: Inject<DatabaseConfig, "cfg:db-replica">,
  ) {}

  public describe(): string {
    const p = this.primary;
    const r = this.replica;
    return (
      `primary=${p.host}/${p.database} (pool ${p.poolSize}), ` +
      `replica=${r.host}/${r.database} (pool ${r.poolSize})`
    );
  }
}
