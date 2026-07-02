// The concrete services. Neither class knows how it's wired or which token
// its config came from -- that lives entirely in main.ts. Static `built`
// counters exist purely so the program can print, and a future test can
// assert on, proof of singleton sharing / distinct instances.

import type { DatabaseConfig, ServerConfig } from "./contracts.js";

export class ApiServer {
  public static built = 0;

  public constructor(private readonly config: ServerConfig) {
    ApiServer.built += 1;
  }

  public describe(): string {
    const tls = this.config.ssl ? " (tls)" : "";
    return `listening on ${this.config.host}:${this.config.port}${tls}`;
  }
}

/**
 * Depends on TWO instances of the SAME `DatabaseConfig` shape -- proof that
 * binding the same schema against two different config sections yields two
 * independent values, disambiguated here purely by constructor-parameter
 * ORDER (see `forCtor(DatabasePool).signature(DB_PRIMARY, DB_REPLICA)` in
 * main.ts; there is no transformer to read a brand/annotation).
 */
export class DatabasePool {
  public static built = 0;

  public constructor(
    public readonly primary: DatabaseConfig,
    public readonly replica: DatabaseConfig,
  ) {
    DatabasePool.built += 1;
  }

  public describe(): string {
    const p = this.primary;
    const r = this.replica;
    return (
      `primary=${p.host}/${p.database} (pool ${p.poolSize}), `
      + `replica=${r.host}/${r.database} (pool ${r.poolSize})`
    );
  }
}
