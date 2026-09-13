CREATE TABLE "farm_inventory" (
	"farm_id" uuid NOT NULL,
	"item_key" varchar(50) NOT NULL,
	"quantity" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "farm_inventory_pkey" PRIMARY KEY("farm_id","item_key"),
	CONSTRAINT "farm_inventory_quantity_nonnegative" CHECK ("farm_inventory"."quantity" >= 0)
);
--> statement-breakpoint
ALTER TABLE "farm_inventory" ADD CONSTRAINT "farm_inventory_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE cascade ON UPDATE no action;