ALTER TABLE "farm_buildings" ADD COLUMN "loading_tile" jsonb;--> statement-breakpoint
ALTER TABLE "farms" ADD COLUMN "roads" jsonb DEFAULT '[]'::jsonb NOT NULL;