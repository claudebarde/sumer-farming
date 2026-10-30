ALTER TABLE "ziggurat_projects"
  ADD COLUMN "foundation_clay" integer NOT NULL DEFAULT 0 CHECK (foundation_clay BETWEEN 0 AND 30),
  ADD COLUMN "foundation_reed" integer NOT NULL DEFAULT 0 CHECK (foundation_reed BETWEEN 0 AND 15),
  ADD COLUMN "foundations_started_at" timestamptz,
  ADD COLUMN "foundations_complete_at" timestamptz,
  ADD CONSTRAINT "ziggurat_foundations_timing" CHECK (
    (foundations_started_at IS NULL AND foundations_complete_at IS NULL) OR
    (fundraising_opened_at IS NOT NULL AND foundation_clay = 30 AND foundation_reed = 15
      AND foundations_started_at IS NOT NULL AND foundations_complete_at IS NOT NULL
      AND foundations_complete_at = foundations_started_at + interval '6 hours')
  );
CREATE TABLE "ziggurat_donations" (
  "neighbourhood_id" uuid NOT NULL REFERENCES "neighbourhoods"("id") ON DELETE CASCADE,
  "player_id" uuid NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "idempotency_key" uuid NOT NULL,
  "requested_clay" integer NOT NULL CHECK (requested_clay BETWEEN 0 AND 30),
  "requested_reed" integer NOT NULL CHECK (requested_reed BETWEEN 0 AND 15),
  "clay" integer NOT NULL CHECK (clay >= 0 AND clay <= requested_clay),
  "reed" integer NOT NULL CHECK (reed >= 0 AND reed <= requested_reed),
  "points" integer NOT NULL CHECK (points = (clay + reed) * 2 AND points > 0),
  "donated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("player_id", "idempotency_key")
);
CREATE INDEX "ziggurat_donations_neighbourhood" ON "ziggurat_donations"("neighbourhood_id");
