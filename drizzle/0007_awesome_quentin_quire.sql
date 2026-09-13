CREATE TABLE "farm_crops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"crop_key" varchar(50) NOT NULL,
	"column" integer NOT NULL,
	"row" integer NOT NULL,
	"planted_at" timestamp with time zone NOT NULL,
	"growth_completes_at" timestamp with time zone NOT NULL,
	CONSTRAINT "farm_crops_farm_position_unique" UNIQUE("farm_id","column","row"),
	CONSTRAINT "farm_crops_growth_completion_after_planting" CHECK ("farm_crops"."growth_completes_at" > "farm_crops"."planted_at")
);
--> statement-breakpoint
ALTER TABLE "farm_crops" ADD CONSTRAINT "farm_crops_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE cascade ON UPDATE no action;