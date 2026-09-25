import { match } from "ts-pattern";
import type { FarmerCommand } from "../../stores/farmerCommandStore";

export type FarmerArrivalAlignment = "overlap" | "tile";
export type CardinalDirection = "up" | "down" | "left" | "right";

export const getFarmerArrivalAlignment = (command: FarmerCommand): FarmerArrivalAlignment =>
  match(command)
    .with({ type: "fishing" }, () => "tile" as const)
    .with({ type: "brewery_supply" }, () => "tile" as const)
    .with({ type: "deposit", storage: "granary" }, () => "tile" as const)
    .with({ type: "withdraw", storage: "granary" }, () => "tile" as const)
    .otherwise(() => "overlap" as const);

export const getFarmerDestination = (
  target: { readonly column: number; readonly row: number },
  direction: CardinalDirection | null,
  tileSize: number,
  alignment: FarmerArrivalAlignment
): { readonly x: number; readonly y: number } => {
  const x = target.column * tileSize;
  const y = target.row * tileSize;
  if (alignment === "tile" || direction === null) return { x, y };

  const halfTile = tileSize / 2;
  return match(direction)
    .with("up", () => ({ x, y: y + halfTile }))
    .with("down", () => ({ x, y: y - halfTile }))
    .with("left", () => ({ x: x + halfTile, y }))
    .with("right", () => ({ x: x - halfTile, y }))
    .exhaustive();
};
