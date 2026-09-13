ALTER TYPE "public"."farm_object_type" ADD VALUE 'reeds';--> statement-breakpoint
ALTER TABLE "farms" ADD COLUMN "gathering_item_key" varchar(50);--> statement-breakpoint
ALTER TABLE "farms" ADD COLUMN "gathering_column" integer;--> statement-breakpoint
ALTER TABLE "farms" ADD COLUMN "gathering_row" integer;--> statement-breakpoint
ALTER TABLE "farms" ADD COLUMN "gathering_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "farms" ADD COLUMN "gathering_completes_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "farms" ADD CONSTRAINT "farms_gathering_fields_together" CHECK (("farms"."gathering_item_key" IS NULL AND "farms"."gathering_column" IS NULL AND "farms"."gathering_row" IS NULL AND "farms"."gathering_started_at" IS NULL AND "farms"."gathering_completes_at" IS NULL) OR ("farms"."gathering_item_key" IS NOT NULL AND "farms"."gathering_column" IS NOT NULL AND "farms"."gathering_row" IS NOT NULL AND "farms"."gathering_started_at" IS NOT NULL AND "farms"."gathering_completes_at" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "farms" ADD CONSTRAINT "farms_gathering_completion_after_start" CHECK ("farms"."gathering_completes_at" IS NULL OR "farms"."gathering_completes_at" > "farms"."gathering_started_at");