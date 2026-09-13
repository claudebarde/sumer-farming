CREATE TYPE "public"."shekel_transaction_type" AS ENUM('market_sale', 'market_purchase');--> statement-breakpoint
CREATE TABLE "shekel_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"type" "shekel_transaction_type" NOT NULL,
	"delta" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"item_key" varchar(50) NOT NULL,
	"item_quantity" integer NOT NULL,
	"unit_price" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shekel_transactions_player_idempotency_unique" UNIQUE("player_id","idempotency_key"),
	CONSTRAINT "shekel_transactions_delta_nonzero" CHECK ("shekel_transactions"."delta" <> 0),
	CONSTRAINT "shekel_transactions_balance_after_nonnegative" CHECK ("shekel_transactions"."balance_after" >= 0),
	CONSTRAINT "shekel_transactions_item_quantity_positive" CHECK ("shekel_transactions"."item_quantity" > 0),
	CONSTRAINT "shekel_transactions_unit_price_positive" CHECK ("shekel_transactions"."unit_price" > 0),
	CONSTRAINT "shekel_transactions_delta_matches_trade" CHECK (abs("shekel_transactions"."delta") = "shekel_transactions"."item_quantity" * "shekel_transactions"."unit_price"),
	CONSTRAINT "shekel_transactions_direction_matches_type" CHECK (("shekel_transactions"."type" = 'market_sale' AND "shekel_transactions"."delta" > 0) OR ("shekel_transactions"."type" = 'market_purchase' AND "shekel_transactions"."delta" < 0))
);
--> statement-breakpoint
ALTER TABLE "shekel_transactions" ADD CONSTRAINT "shekel_transactions_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shekel_transactions_player_created_at_idx" ON "shekel_transactions" USING btree ("player_id","created_at");