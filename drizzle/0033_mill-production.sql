ALTER TYPE "public"."farm_building_type" ADD VALUE 'mill';--> statement-breakpoint
ALTER TABLE "farms" ALTER COLUMN "progression_stats" SET DEFAULT '{"harvestedBarley":0,"harvests":0,"beerProduced":0,"fishFed":0,"processedBarley":0}'::jsonb;--> statement-breakpoint
ALTER TABLE "farms" ADD COLUMN "milling" jsonb;--> statement-breakpoint
UPDATE "farms" SET "progression_stats" = '{"processedBarley":0}'::jsonb || "progression_stats";
