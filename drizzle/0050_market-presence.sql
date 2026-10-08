CREATE TABLE "market_presence" (
  "player_id" uuid NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "session_id" uuid NOT NULL,
  "position" jsonb NOT NULL,
  "closed" boolean DEFAULT false NOT NULL,
  "seen_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("player_id", "session_id")
);
