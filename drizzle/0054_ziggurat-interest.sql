CREATE TABLE "ziggurat_projects" (
  "neighbourhood_id" uuid PRIMARY KEY REFERENCES "neighbourhoods"("id") ON DELETE CASCADE,
  "fundraising_opened_at" timestamptz
);
CREATE TABLE "ziggurat_interests" (
  "neighbourhood_id" uuid NOT NULL REFERENCES "neighbourhoods"("id") ON DELETE CASCADE,
  "player_id" uuid NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "registered_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("neighbourhood_id", "player_id")
);
