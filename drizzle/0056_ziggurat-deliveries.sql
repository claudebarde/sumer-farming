CREATE TABLE "ziggurat_deliveries" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 "neighbourhood_id" uuid NOT NULL REFERENCES "neighbourhoods"("id") ON DELETE CASCADE,
 "player_id" uuid NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
 "slot" integer NOT NULL CHECK (slot BETWEEN 1 AND 10),
 "starts_at" timestamptz NOT NULL,
 "completes_at" timestamptz NOT NULL CHECK (completes_at > starts_at)
);
CREATE INDEX "ziggurat_deliveries_queue" ON "ziggurat_deliveries" ("neighbourhood_id", "completes_at");
