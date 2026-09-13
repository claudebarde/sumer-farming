CREATE TABLE "farm_ground_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"item_key" varchar(50) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"column" integer NOT NULL,
	"row" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "farm_ground_items_farm_position_unique" UNIQUE("farm_id","column","row"),
	CONSTRAINT "farm_ground_items_quantity_positive" CHECK ("farm_ground_items"."quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "farms" ADD COLUMN "carried_item_key" varchar(50);--> statement-breakpoint
ALTER TABLE "farm_ground_items" ADD CONSTRAINT "farm_ground_items_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "farm_ground_items" ("farm_id", "item_key", "quantity", "column", "row")
SELECT "farms"."id", 'barley', 1, 2, "positions"."row"
FROM "farms"
CROSS JOIN (VALUES (0), (1)) AS "positions"("row")
ON CONFLICT ("farm_id", "column", "row") DO NOTHING;
