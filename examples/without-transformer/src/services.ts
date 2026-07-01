// The same concrete services as ../../with-transformer/src/services.ts.
// These classes carry NO knowledge of how they are wired or which token
// their config comes from -- that lives in main.ts (hand-written), exactly
// where the transformer would otherwise inject it. Note there is no
// `Inject<T,"tok">` import here: without the transformer that brand is
// inert (a phantom field nobody reads), so the two DatabaseConfig params are
// disambiguated purely by REGISTRATION ORDER via forCtor(...).signature(...)
// in main.ts, not by annotation.

import type { DatabaseConfig, ServerConfig } from "./contracts.js";

export class ApiServer {
  public constructor(private readonly config: ServerConfig) {}

  public describe(): string {
    const tls = this.config.ssl ? " (tls)" : "";
    return `listening on ${this.config.host}:${this.config.port}${tls}`;
  }
}

export class DatabasePool {
  public constructor(
    private readonly primary: DatabaseConfig,
    private readonly replica: DatabaseConfig,
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
