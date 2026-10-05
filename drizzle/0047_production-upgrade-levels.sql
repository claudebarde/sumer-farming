ALTER TABLE "farms" DROP CONSTRAINT "farms_level_valid";--> statement-breakpoint
ALTER TABLE "farms" ADD CONSTRAINT "farms_level_valid" CHECK ("farms"."level" >= 1 AND "farms"."level" <= 11);