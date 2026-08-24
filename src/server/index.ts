// src/server/index.ts

import { Hono } from "hono";
import { Client } from "pg";

import { createDatabase } from "./db/client";
import { players } from "./db/schema";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", c => {
  return c.json({ ok: true });
});

app.get("/api/db/health", async c => {
  const client = new Client({
    connectionString: c.env.HYPERDRIVE.connectionString
  });

  try {
    await client.connect();

    const db = createDatabase(client);
    await db.select({ id: players.id }).from(players).limit(1);

    return c.json({ ok: true });
  } catch (error) {
    console.error("Database health check failed", error);

    return c.json({ ok: false }, 503);
  } finally {
    await client.end().catch(error => {
      console.error("Failed to close database connection", error);
    });
  }
});

app.get("/api/farm", c => {
  return c.json({
    silver: 20,
    barley: 10
  });
});

export default app;
