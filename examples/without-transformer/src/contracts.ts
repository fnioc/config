// Plain TypeScript interfaces -- nothing @fnioc-specific lives here. What's
// interesting is how they get bound (SchemaFor<T>-checked, by hand, in
// main.ts) and wired (explicit tokens + forCtor(...).signature(...), also in
// main.ts) without any transformer or decorator support.

export interface ServerConfig {
  readonly host: string;
  readonly port: number;
  readonly ssl?: boolean;
}

/** Same shape reused for two independent, section-bound instances -- see main.ts. */
export interface DatabaseConfig {
  readonly host: string;
  readonly database: string;
  readonly poolSize: number;
}
