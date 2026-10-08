import type { FarmerCommand } from "../stores/farmerCommandStore";
import type { GameCommand } from "../../schemas/gameCommands";

/** Production intentions are submitted before (never from) arrival callbacks. */
export const productionStartCommand = (
  command: FarmerCommand,
  origin: { readonly column: number; readonly row: number },
  expectedFarmVersion: number
): GameCommand | null => {
  if (command.type === "mill") return { type: "start_milling", recipe: command.recipe, worker: command.worker,
    target: { column: command.target.column - origin.column, row: command.target.row - origin.row }, expectedFarmVersion };
  if (command.type === "production" && command.action === "bake") return { type: "start_baking", buildingId: command.buildingId, expectedFarmVersion };
  if (command.type === "brewery_supply" && command.action === "start_brewing") return { type: "brewery_supply", action: "start_brewing",
    target: { column: command.target.column - origin.column, row: command.target.row - origin.row }, expectedFarmVersion };
  return null;
};
