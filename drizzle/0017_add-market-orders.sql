CREATE TYPE "public"."market_order_side" AS ENUM('sell', 'buy');--> statement-breakpoint
CREATE TYPE "public"."market_order_status" AS ENUM('open', 'filled', 'cancelled');--> statement-breakpoint
CREATE TABLE "market_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"side" "market_order_side" NOT NULL,
	"status" "market_order_status" DEFAULT 'open' NOT NULL,
	"item_key" varchar(50) NOT NULL,
	"unit_price" integer NOT NULL,
	"original_quantity" integer NOT NULL,
	"remaining_quantity" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "market_orders_player_idempotency_unique" UNIQUE("player_id","idempotency_key"),
	CONSTRAINT "market_orders_unit_price_positive" CHECK ("market_orders"."unit_price" > 0),
	CONSTRAINT "market_orders_original_quantity_positive" CHECK ("market_orders"."original_quantity" > 0),
	CONSTRAINT "market_orders_remaining_quantity_in_range" CHECK ("market_orders"."remaining_quantity" >= 0 AND "market_orders"."remaining_quantity" <= "market_orders"."original_quantity"),
	CONSTRAINT "market_orders_status_matches_quantity" CHECK (("market_orders"."status" = 'open' AND "market_orders"."remaining_quantity" > 0) OR ("market_orders"."status" IN ('filled', 'cancelled') AND "market_orders"."remaining_quantity" = 0))
);
--> statement-breakpoint
ALTER TABLE "market_orders" ADD CONSTRAINT "market_orders_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "market_orders_order_book_idx" ON "market_orders" USING btree ("item_key","side","status","unit_price","created_at");--> statement-breakpoint
CREATE INDEX "market_orders_player_status_idx" ON "market_orders" USING btree ("player_id","status","created_at");