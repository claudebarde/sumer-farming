CREATE TYPE "public"."farm_improvement_type" AS ENUM('irrigation');--> statement-breakpoint
CREATE TABLE "farm_improvements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"type" "farm_improvement_type" NOT NULL,
	"column" integer NOT NULL,
	"row" integer NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completes_at" timestamp with time zone NOT NULL,
	CONSTRAINT "farm_improvements_farm_position_unique" UNIQUE("farm_id","column","row"),
	CONSTRAINT "farm_improvements_completion_after_start" CHECK ("farm_improvements"."completes_at" > "farm_improvements"."started_at")
);
--> statement-breakpoint
ALTER TABLE "farm_improvements" ADD CONSTRAINT "farm_improvements_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE cascade ON UPDATE no action;