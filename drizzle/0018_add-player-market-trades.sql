CREATE TABLE "market_trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"buyer_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"item_key" varchar(50) NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" integer NOT NULL,
	"buyer_transaction_id" uuid NOT NULL,
	"seller_transaction_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "market_trades_buyer_transaction_id_unique" UNIQUE("buyer_transaction_id"),
	CONSTRAINT "market_trades_seller_transaction_id_unique" UNIQUE("seller_transaction_id"),
	CONSTRAINT "market_trades_buyer_idempotency_unique" UNIQUE("buyer_id","idempotency_key"),
	CONSTRAINT "market_trades_positive" CHECK ("market_trades"."quantity" > 0 AND "market_trades"."unit_price" > 0),
	CONSTRAINT "market_trades_distinct_players" CHECK ("market_trades"."buyer_id" <> "market_trades"."seller_id")
);
--> statement-breakpoint
ALTER TABLE "shekel_transactions" ADD COLUMN "source" varchar(10) DEFAULT 'npc' NOT NULL;--> statement-breakpoint
ALTER TABLE "market_trades" ADD CONSTRAINT "market_trades_order_id_market_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."market_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_trades" ADD CONSTRAINT "market_trades_buyer_id_players_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_trades" ADD CONSTRAINT "market_trades_seller_id_players_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_trades" ADD CONSTRAINT "market_trades_buyer_transaction_id_shekel_transactions_id_fk" FOREIGN KEY ("buyer_transaction_id") REFERENCES "public"."shekel_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_trades" ADD CONSTRAINT "market_trades_seller_transaction_id_shekel_transactions_id_fk" FOREIGN KEY ("seller_transaction_id") REFERENCES "public"."shekel_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "market_trades_item_created_idx" ON "market_trades" USING btree ("item_key","created_at");