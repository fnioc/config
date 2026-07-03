// Plain TypeScript interfaces -- what's interesting is how they get bound
// (SchemaFor<T>-checked, by hand, in main.ts), not how they're declared here.

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
