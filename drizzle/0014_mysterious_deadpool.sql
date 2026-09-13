ALTER TABLE "farm_ground_items" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "farms" ADD COLUMN "carried_item_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "farms" ADD COLUMN "cultivation_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "farms" ADD COLUMN "next_barley_consumption_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "farms" ADD COLUMN "hungry_since" timestamp with time zone;--> statement-breakpoint
UPDATE "farm_ground_items" SET "expires_at" = now() + interval '3 days' WHERE "item_key" = 'barley';--> statement-breakpoint
UPDATE "farms" SET "carried_item_expires_at" = now() + interval '3 days' WHERE "carried_item_key" = 'barley';--> statement-breakpoint
UPDATE "farms" SET "cultivation_started_at" = now(), "next_barley_consumption_at" = now() + interval '1 day' WHERE EXISTS (SELECT 1 FROM "farm_crops" WHERE "farm_crops"."farm_id" = "farms"."id");--> statement-breakpoint
ALTER TABLE "farm_ground_items" ADD CONSTRAINT "farm_ground_items_barley_has_expiry" CHECK ("farm_ground_items"."item_key" <> 'barley' OR "farm_ground_items"."expires_at" IS NOT NULL);
