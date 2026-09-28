import { match, P } from "ts-pattern";
import type { GameCommand } from "../../schemas/gameCommands";
import { marketUnlockLevel } from "../../game-data/progression";

export const commandUnlockLevel = (command: GameCommand, orderItem?: string): number => match(command)
  .with({ type: "build_granary" }, () => 2)
  .with({ type: "build_brewery" }, () => 5)
  .with({ type: P.union("fishing", "cast_fishing", "give_farmer_fish") }, () => 4)
  .with({ type: P.union("brewery_supply", "give_farmer_beer") }, () => 5)
  .with({ type: "deliver_npc_request" }, () => 7)
  .with({ type: P.union("buy_from_npc_market", "sell_to_npc_market", "create_market_sell_order") }, c => marketUnlockLevel(c.itemKey))
  .with({ type: "buy_market_sell_order" }, () => marketUnlockLevel(orderItem ?? "beer"))
  .otherwise(() => 1);
