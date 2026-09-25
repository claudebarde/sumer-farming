ALTER TYPE "public"."shekel_transaction_type" ADD VALUE 'request_reward';--> statement-breakpoint
CREATE TABLE "npc_request_boards" (
	"farm_id" uuid PRIMARY KEY NOT NULL,
	"anchor" timestamp with time zone NOT NULL,
	"cycle" integer NOT NULL,
	"brewer" boolean NOT NULL,
	"completed" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "npc_request_cycle_nonnegative" CHECK ("npc_request_boards"."cycle" >= 0)
);
--> statement-breakpoint
ALTER TABLE "shekel_transactions" DROP CONSTRAINT "shekel_transactions_direction_matches_type";--> statement-breakpoint
ALTER TABLE "shekel_transactions" ALTER COLUMN "item_key" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "shekel_transactions" ALTER COLUMN "item_quantity" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "shekel_transactions" ALTER COLUMN "unit_price" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "shekel_transactions" ADD COLUMN "request_customer" varchar(100);--> statement-breakpoint
ALTER TABLE "npc_request_boards" ADD CONSTRAINT "npc_request_boards_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shekel_transactions" ADD CONSTRAINT "shekel_transactions_reward_or_trade" CHECK (
      ("shekel_transactions"."type"::text = 'request_reward' AND "shekel_transactions"."request_customer" IS NOT NULL AND "shekel_transactions"."item_key" IS NULL AND "shekel_transactions"."item_quantity" IS NULL AND "shekel_transactions"."unit_price" IS NULL)
      OR ("shekel_transactions"."type"::text <> 'request_reward' AND "shekel_transactions"."request_customer" IS NULL AND "shekel_transactions"."item_key" IS NOT NULL AND "shekel_transactions"."item_quantity" IS NOT NULL AND "shekel_transactions"."unit_price" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "shekel_transactions" ADD CONSTRAINT "shekel_transactions_direction_matches_type" CHECK (("shekel_transactions"."type"::text IN ('market_sale', 'request_reward') AND "shekel_transactions"."delta" > 0) OR ("shekel_transactions"."type" = 'market_purchase' AND "shekel_transactions"."delta" < 0));
