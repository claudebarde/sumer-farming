import type { FarmRoad } from "../../../game-data/roads";
import { getBuildingFootprint } from "../../../game-core/farm/buildings";
import { breweryLoadingCorner, findLoadingTile } from "../../../game-core/farm/roads";
import type { IsoCell } from "./isometricProjection";

/** Keep the shell opening and eventual beer output on the same roadside corner. */
export const breweryOrientationTexture = (
  building: IsoCell & { loadingTile?: IsoCell | null },
  roads: readonly FarmRoad[],
  now: number,
) => {
  const loading = building.loadingTile === undefined
    ? findLoadingTile(getBuildingFootprint("brewery", building), roads, [], new Set(), { building: "brewery", now })
    : building.loadingTile;
  return !loading || breweryLoadingCorner(building, loading) === "B"
    ? "brewery-left-bottom" : "brewery-right-top";
};
