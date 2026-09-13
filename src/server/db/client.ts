import { drizzle } from "drizzle-orm/node-postgres";
import type { Client } from "pg";

import * as schema from "./schema";

export const createDatabase = (client: Client) => drizzle(client, { schema });

export type Database = ReturnType<typeof createDatabase>;
export type DatabaseTransaction = Parameters<
  Parameters<Database["transaction"]>[0]
>[0];
