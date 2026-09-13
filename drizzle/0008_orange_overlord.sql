ALTER TABLE "farm_crops" ADD COLUMN "sowing_started_at" timestamp with time zone;--> statement-breakpoint
UPDATE "farm_crops" SET "sowing_started_at" = "planted_at" - INTERVAL '10 seconds';--> statement-breakpoint
ALTER TABLE "farm_crops" ALTER COLUMN "sowing_started_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "farm_crops" ADD CONSTRAINT "farm_crops_planting_after_sowing_start" CHECK ("farm_crops"."planted_at" > "farm_crops"."sowing_started_at");
