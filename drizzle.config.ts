import { defineConfig } from "drizzle-kit";

const localDatabaseUrl =
  "postgres://sumer:sumer_dev@localhost:5432/sumer_farming";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? localDatabaseUrl
  }
});
