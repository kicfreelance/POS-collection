declare module "embedded-postgres" {
  interface PostgresOptions {
    databaseDir: string;
    port: number;
    user: string;
    password: string;
    authMethod: "scram-sha-256" | "password" | "md5";
    persistent: boolean;
  }

  export default class EmbeddedPostgres {
    constructor(options?: Partial<PostgresOptions>);
    initialise(): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    createDatabase(name: string): Promise<void>;
    dropDatabase(name: string): Promise<void>;
  }
}
