// src/server/index.ts

import { Hono } from "hono";

const app = new Hono();

app.get("/api/health", c => {
  return c.json({ ok: true });
});

app.get("/api/farm", c => {
  return c.json({
    silver: 20,
    barley: 10
  });
});

export default app;
