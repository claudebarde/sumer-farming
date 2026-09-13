ALTER TABLE "farms" ADD COLUMN "carried_item_quantity" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "farms" SET "carried_item_quantity" = 1 WHERE "carried_item_key" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "farms" ADD CONSTRAINT "farms_carried_item_quantity_in_range" CHECK ("farms"."carried_item_quantity" >= 0 AND "farms"."carried_item_quantity" <= 2);--> statement-breakpoint
ALTER TABLE "farms" ADD CONSTRAINT "farms_carried_item_key_matches_quantity" CHECK (("farms"."carried_item_key" IS NULL) = ("farms"."carried_item_quantity" = 0));
