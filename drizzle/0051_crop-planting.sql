ALTER TYPE "shekel_transaction_type" ADD VALUE 'crop_planting';
--> statement-breakpoint
ALTER TABLE "shekel_transactions" DROP CONSTRAINT "shekel_transactions_reward_or_trade";
--> statement-breakpoint
ALTER TABLE "shekel_transactions" DROP CONSTRAINT "shekel_transactions_direction_matches_type";
--> statement-breakpoint
ALTER TABLE "shekel_transactions" ADD CONSTRAINT "shekel_transactions_reward_or_trade" CHECK (
  (type::text = 'request_reward' AND request_customer IS NOT NULL AND item_key IS NULL AND item_quantity IS NULL AND unit_price IS NULL)
  OR (type::text IN ('porter_hire', 'building_upgrade', 'crop_planting') AND request_customer IS NULL AND item_key IS NULL AND item_quantity IS NULL AND unit_price IS NULL)
  OR (type::text NOT IN ('request_reward', 'porter_hire', 'building_upgrade', 'crop_planting') AND request_customer IS NULL AND item_key IS NOT NULL AND item_quantity IS NOT NULL AND unit_price IS NOT NULL));
--> statement-breakpoint
ALTER TABLE "shekel_transactions" ADD CONSTRAINT "shekel_transactions_direction_matches_type" CHECK (
  (type::text IN ('market_sale', 'request_reward') AND delta > 0) OR (type::text IN ('market_purchase', 'porter_hire', 'building_upgrade', 'crop_planting') AND delta < 0));
