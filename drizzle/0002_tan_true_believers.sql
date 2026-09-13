CREATE TYPE "public"."farm_object_type" AS ENUM('rock', 'bush');--> statement-breakpoint
CREATE TABLE "farm_objects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"type" "farm_object_type" NOT NULL,
	"column" integer NOT NULL,
	"row" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "farm_objects_farm_position_unique" UNIQUE("farm_id","column","row")
);
--> statement-breakpoint
ALTER TABLE "farm_objects" ADD CONSTRAINT "farm_objects_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE cascade ON UPDATE no action;