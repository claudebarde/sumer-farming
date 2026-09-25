import { z } from "zod";
import { developmentPlayerHeaders, fetchDevelopmentFarm } from "./developmentPlayer";
import { farmStore } from "../stores/farmStore";
import { fetchTradeHistory } from "./tradeHistory";
import { notificationStore } from "../stores/notificationStore";

import {
  GameCommandSchema,
  type GameCommand
} from "../../schemas/gameCommands";
import { FarmSnapshotSchema, type FarmSnapshot } from "../../schemas/farm";

const GameActionErrorSchema = z.object({
  error: z.object({
    type: z.string(),
    message: z.string()
  })
});

export const executeGameCommand = async (
  command: GameCommand
): Promise<FarmSnapshot> => {
  const response = await fetch("/api/game/action", {
    method: "POST",
    headers: {
      ...developmentPlayerHeaders(),
      "content-type": "application/json"
    },
    body: JSON.stringify(GameCommandSchema.parse(command))
  });
  const body: unknown = await response.json();

  if (!response.ok) {
    const parsedError = GameActionErrorSchema.safeParse(body);
    if (import.meta.env.DEV && parsedError.success && parsedError.data.error.type === "farm_version_conflict") {
      // Refresh before the player retries; never repeat a money/item command automatically.
      await fetchDevelopmentFarm().then(snapshot => farmStore.getState().setReady(snapshot)).catch(() => undefined);
    }
    throw new Error(
      parsedError.success
        ? parsedError.data.error.message
        : "The game command could not be completed"
    );
  }

  const snapshot = FarmSnapshotSchema.parse(body);
  if (command.type === "buy_from_npc_market" || command.type === "sell_to_npc_market" || command.type === "buy_market_sell_order") {
    // Fetch the committed receipt; toast failure must never make a successful
    // economic action appear to have failed. The background poll can retry it.
    void fetchTradeHistory({ limit: 1, transactionKey: command.idempotencyKey }).then(
      history => {
        const trade = history.trades[0];
        if (trade !== undefined) notificationStore.getState().notifyTrade(snapshot.farm.playerId, trade);
      },
      error => console.error("Failed to load trade receipt", error)
    );
  }
  return snapshot;
};
