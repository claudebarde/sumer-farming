ALTER TYPE "farm_building_type" ADD VALUE IF NOT EXISTS 'oilMill';
--> statement-breakpoint
ALTER TABLE "farm_buildings" DROP CONSTRAINT "farm_buildings_empty_jars_valid";
--> statement-breakpoint
ALTER TABLE "farm_buildings" ADD CONSTRAINT "farm_buildings_empty_jars_valid" CHECK (empty_beer_jars >= 0 AND ((type::text = 'oilMill' AND empty_beer_jars <= 3) OR (type::text = 'brewery' AND empty_beer_jars <= 10) OR empty_beer_jars = 0));
