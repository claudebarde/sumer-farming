import { INITIAL_FARM_CONFIG as config } from "../../../game-data/initialFarm";
import { MARKET_UNLOCK_LEVEL } from "../../../game-data/progression";
import type { FarmSnapshot } from "../../../schemas/farm";
import { plantingBlocker } from "./isometricPlanting";
import type { IsoCell } from "./isometricProjection";
import { FARM_MARKET_ORIGIN, FARM_MARKET_ENTRANCE, isFarmMarketTile } from "../../../game-data/farmMarket";
import type { MarketScope } from "../../stores/marketUiStore";

/** Map stand/merchant selections to the shared flat/isometric trading dialogs. */
export const isometricTradeScope = (kind: string | undefined): MarketScope | null =>
  kind === "produceMarket" ? "produce" : kind === "barleyMarket" ? "barley" : kind === "bakingMarket" ? "bread" : kind === "beerMarket" ? "beer" : null;

export const marketOrigin: IsoCell = FARM_MARKET_ORIGIN;
export const marketEntrance: IsoCell = FARM_MARKET_ENTRANCE;
export const isMarketTile = isFarmMarketTile;
export const canVisitIsometricMarket = (snapshot: FarmSnapshot, now: number): boolean =>
  (snapshot.farm.progression?.level ?? 1) >= MARKET_UNLOCK_LEVEL &&
  !snapshot.farm.carriedItem && !plantingBlocker(snapshot, now);

export const marketReturnOrigin: IsoCell = { column: -3, row: 3 };
export const marketReturnEntrance: IsoCell = { column: -2, row: config.roadRow };
