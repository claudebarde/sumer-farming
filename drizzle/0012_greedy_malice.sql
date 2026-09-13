CREATE TYPE "public"."farm_building_type" AS ENUM('granary');--> statement-breakpoint
CREATE TABLE "farm_buildings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"type" "farm_building_type" NOT NULL,
	"column" integer NOT NULL,
	"row" integer NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completes_at" timestamp with time zone NOT NULL,
	CONSTRAINT "farm_buildings_farm_position_unique" UNIQUE("farm_id","column","row"),
	CONSTRAINT "farm_buildings_completion_after_start" CHECK ("farm_buildings"."completes_at" > "farm_buildings"."started_at")
);
--> statement-breakpoint
ALTER TABLE "farm_buildings" ADD CONSTRAINT "farm_buildings_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE cascade ON UPDATE no action;