ALTER TABLE "farms" ADD COLUMN "level" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "farms" ADD COLUMN "progression_stats" jsonb DEFAULT '{"harvestedBarley":0,"harvests":0,"beerProduced":0,"fishFed":0}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "farms" ADD CONSTRAINT "farms_level_valid" CHECK ("farms"."level" >= 1 AND "farms"."level" <= 10);