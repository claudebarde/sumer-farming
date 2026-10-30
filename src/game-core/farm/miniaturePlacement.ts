import type { FarmSnapshot } from "../../schemas/farm";
import { isBuildingGround, isFixedBuildingGround } from "./land";
import { getBuildingFootprint } from "./buildings";
type Cell = { readonly column: number; readonly row: number };
/** Small cosmetic objects need free ground, but no road or worker. */
export const miniaturePlacementError = (snapshot: FarmSnapshot, cell: Cell): string | null => {
  if (!isBuildingGround(cell) || isFixedBuildingGround(cell)) return "Choose a free ground tile.";
  const occupied = [...snapshot.objects, ...snapshot.crops, ...snapshot.groundItems,
    ...snapshot.improvements, ...snapshot.farm.roads,
    ...snapshot.buildings.flatMap(b => [...getBuildingFootprint(b.type,b), ...(b.loadingTile ? [b.loadingTile] : [])])];
  return occupied.some(p => p.column === cell.column && p.row === cell.row) ? "This tile is occupied." : null;
};
