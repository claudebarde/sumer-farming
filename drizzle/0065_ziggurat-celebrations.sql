CREATE TABLE "ziggurat_celebrations" (
  "neighbourhood_id" uuid NOT NULL REFERENCES "neighbourhoods"("id") ON DELETE CASCADE,
  "player_id" uuid NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("neighbourhood_id", "player_id")
);
