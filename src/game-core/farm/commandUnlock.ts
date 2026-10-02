import { match, P } from "ts-pattern";
import type { GameCommand } from "../../schemas/gameCommands";
import { BREAD_OVEN_UNLOCK_LEVEL, BREWERY_UNLOCK_LEVEL, marketUnlockLevel } from "../../game-data/progression";

export const commandUnlockLevel = (command: GameCommand, orderItem?: string): number => match(command)
  .with({ type: "build_granary" }, () => 2)
  .with({ type: "start_milling", worker: "donkey" }, () => 7)
  .with({ type: P.union("build_mill", "start_milling", "mill_delivery") }, () => 5)
  .with({ type: "build_brewery" }, () => BREWERY_UNLOCK_LEVEL)
  .with({ type: P.union("build_bread_oven", "start_baking") }, () => BREAD_OVEN_UNLOCK_LEVEL)
  .with({ type: "production_delivery" }, () => 6)
  .with({ type: P.union("fishing", "cast_fishing", "give_farmer_fish") }, () => 4)
  .with({ type: P.union("brewery_supply", "give_farmer_beer", "give_farmer_bread") }, () => 6)
  .with({ type: "deliver_npc_request" }, () => 7)
  .with({ type: P.union("buy_from_npc_market", "sell_to_npc_market", "create_market_sell_order") }, c => marketUnlockLevel(c.itemKey))
  .with({ type: "buy_market_sell_order" }, () => marketUnlockLevel(orderItem ?? "beer"))
  .otherwise(() => 1);
