import { farmerProductionJob } from "../../game-core/farm/farmerProduction";
import { FARM_SPRITES } from "../../assets/farmSprites";
import {
  plantableFields,
  harvestableFields
} from "../../game-core/farm/batchPlanting";
import { batchPlantingStore } from "../stores/batchPlantingStore";
import BatchPlantingControls from "./BatchPlantingControls";
import { useEffect, useState } from "react";
import granaryImage from "../../assets/sprite_assets/pngs/granary.png";
import breweryImage from "../../assets/sprite_assets/pngs/brewery.png";
import breadOvenImage from "../../assets/sprite_assets/pngs/bread-oven-idle.png";
import bakingToolsImage from "../../assets/sprite_assets/pngs/wooden-baking-tools.png";
import barleyImage from "../../assets/sprite_assets/pngs/wheat-sheaf.png";
import flourBagsImage from "../../assets/sprite_assets/pngs/flour-bags.png";
import shekelsImage from "../../assets/sprite_assets/pngs/shekels.png";
import fishImage from "../../assets/sprite_assets/pngs/fish.png";
import reedImage from "../../assets/sprite_assets/pngs/reed-bundle.png";
import clayImage from "../../assets/sprite_assets/pngs/brick-pile.png";
import HappinessMeter from "./HappinessMeter";
import RationMeter from "./RationMeter";
import FarmerPanel from "./FarmerPanel";
import MillContent from "./MillContent";
import BreadOvenContent from "./BreadOvenContent";
import beerJarsImage from "../../assets/sprite_assets/pngs/beer-jars.png";
import breadBasketImage from "../../assets/sprite_assets/pngs/bread-basket.png";
import millImage from "../../assets/sprite_assets/pngs/empty-mill.png";
import { Dialog, Popover, Tabs } from "radix-ui";
import {
  Cross2Icon,
  ExternalLinkIcon,
  ExclamationTriangleIcon
} from "@radix-ui/react-icons";
import { match } from "ts-pattern";
import styles from "../styles/GameCanvas.module.scss";
import { GAME_CONTAINER_ID, TILE_SIZE } from "../game/phaser/config";
import { createGame } from "../game/phaser/game";
import { MainScene } from "../game/phaser/scenes/MainScene";
import { useStore } from "zustand";
import { gridStore } from "../stores/gridStore";
import { interactionStore } from "../stores/interactionStore";
import {
  getFarmerMood,
  validateBeerTreat
} from "../../game-core/farm/wellbeing";
import {
  getBrewingState,
  validateBrewing,
  brewingErrors,
  readyBeerQuantity
} from "../../game-core/farm/brewing";
import {
  BREWERY_WATER_CAPACITY,
  BREWERY_EMPTY_JAR_CAPACITY,
  BEER_RECIPE
} from "../../game-data/brewing";
import {
  farmerCommandStore,
  type FarmerCommandInput
} from "../stores/farmerCommandStore";
import type { Tile } from "../game/phaser/types";
import { executeGameCommand } from "../api/gameActions";
import { fetchMarketQuotes } from "../api/marketQuotes";
import MarketTradeHistory from "./MarketTradeHistory";
import MarketListings from "./MarketListings";
import MerchantRequests from "./MerchantRequests";
import FarmLevelDialog from "./FarmLevelDialog";
import {
  granaryLimitForLevel,
  marketUnlockLevel,
  canOpenMarketStand
} from "../../game-data/progression";
import FishingControls from "./FishingControls";
import FetchControls from "./FetchControls";
import { fetchStore } from "../stores/fetchStore";
import { FISH_CAPACITY } from "../../game-data/fishing";
import { fetchDevelopmentFarm } from "../api/developmentPlayer";
import type { MarketQuotes } from "../../schemas/market";
import {
  MARKET_ITEM_DEFINITIONS,
  type MarketItemKey
} from "../../game-data/marketItems";
import { farmStore } from "../stores/farmStore";
import { buildingPlacementStore } from "../stores/buildingPlacementStore";
import {
  MARKET_TITLES,
  marketIncludesItem,
  marketUiStore
} from "../stores/marketUiStore";
import {
  calculateFarmStorageCapacity,
  granaryCapacityForLevel,
  FARMER_CARRY_CAPACITY,
  FARM_STORAGE_CAPACITY
} from "../../game-data/storage";
import {
  BREAD_OVEN_DEFINITION,
  FARM_BUILDING_DEFINITIONS
} from "../../game-data/buildings";
import { INITIAL_FARM_CONFIG } from "../../game-data/initialFarm";
import {
  isRoadIntersection,
  validateRoadPlacement
} from "../../game-core/farm/roads";
import {
  isInsideFarmWorld,
  isGatherableRiverbank
} from "../../game-core/farm/worldBounds";

type MarketQuoteState =
  | { readonly type: "idle" }
  | { readonly type: "loading" }
  | { readonly type: "ready"; readonly quotes: MarketQuotes }
  | { readonly type: "failed"; readonly reason: string };

if (import.meta.hot) {
  import.meta.hot.accept(
    [
      "../game/phaser/config",
      "../game/phaser/game",
      "../game/phaser/scenes/MainScene"
    ],
    () => {
      window.location.reload();
    }
  );
}

const formatRemainingTime = (deadline: string, now: number): string => {
  const remainingMinutes = Math.max(
    0,
    Math.ceil((Date.parse(deadline) - now) / 60_000)
  );
  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes % 60;

  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

const formatShekels = (quantity: number): string =>
  `${quantity} ${quantity === 1 ? "shekel" : "shekels"}`;

export default function GameCanvas() {
  const [isOpenManageDialog, setIsOpenManageDialog] = useState(false);
  const [canvasBoundary, setCanvasBoundary] = useState<HTMLDivElement | null>(
    null
  );
  const [destroyMaterialPending, setDestroyMaterialPending] = useState(false);
  const [destroyMaterialError, setDestroyMaterialError] = useState<{
    id: string;
    message: string;
  } | null>(null);
  const [storageClock, setStorageClock] = useState(() => Date.now());
  const [marketQuantities, setMarketQuantities] = useState<
    Record<string, number>
  >({});
  const [marketTradePending, setMarketTradePending] = useState(false);
  const [marketTradeError, setMarketTradeError] = useState<string | null>(null);
  const [marketSellPrices, setMarketSellPrices] = useState<
    Partial<Record<MarketItemKey, number>>
  >({});
  const [marketQuoteState, setMarketQuoteState] = useState<MarketQuoteState>({
    type: "idle"
  });
  const [marketQuoteRefresh, setMarketQuoteRefresh] = useState(0);

  const selectedTile = useStore(interactionStore, state => state.selectedTile);
  const carriedItem = useStore(farmerCommandStore, state => state.carriedItem);
  const farmState = useStore(farmStore, state => state.farm);
  const fetchActive = useStore(fetchStore, state => state.phase !== "idle");
  const farmLevel =
    farmState.type === "ready"
      ? (farmState.snapshot.farm.progression?.level ?? 1)
      : 1;
  const isOpenMarketDialog = useStore(
    marketUiStore,
    state => state.isOpen && canOpenMarketStand(state.scope, farmLevel)
  );
  const marketScope = useStore(marketUiStore, state => state.scope);
  const marketSceneVisible = useStore(
    marketUiStore,
    state => state.location === "market"
  );
  const setMarketDialogOpen = useStore(marketUiStore, state => state.setOpen);
  const storedBarley =
    farmState.type === "ready"
      ? (farmState.snapshot.inventory.find(item => item.itemKey === "barley")
          ?.quantity ?? 0)
      : 0;
  const availableReed =
    farmState.type === "ready"
      ? farmState.snapshot.groundItems
          .filter(item => item.itemKey === "reed")
          .reduce((quantity, item) => quantity + item.quantity, 0)
      : 0;
  const availableClay =
    farmState.type === "ready"
      ? farmState.snapshot.groundItems
          .filter(item => item.itemKey === "clay")
          .reduce((quantity, item) => quantity + item.quantity, 0)
      : 0;
  const granaryBarley =
    farmState.type === "ready"
      ? farmState.snapshot.buildings
          .filter(
            building =>
              building.type === "granary" &&
              Date.parse(building.completesAt) <= storageClock
          )
          .reduce((quantity, building) => quantity + building.storedBarley, 0)
      : 0;
  const carriedBarley =
    carriedItem?.itemKey === "barley" ? carriedItem.quantity : 0;
  const exposedBarley =
    farmState.type === "ready"
      ? farmState.snapshot.groundItems
          .filter(item => item.itemKey === "barley")
          .reduce((quantity, item) => quantity + item.quantity, 0)
      : 0;
  const breweryBarley =
    farmState.type === "ready"
      ? farmState.snapshot.buildings.reduce(
          (total, building) => total + building.brewingBarley,
          0
        )
      : 0;
  const totalBarley =
    storedBarley +
    granaryBarley +
    carriedBarley +
    exposedBarley +
    breweryBarley;
  const carriedReed =
    carriedItem?.itemKey === "reed" ? carriedItem.quantity : 0;
  const carriedClay =
    carriedItem?.itemKey === "clay" ? carriedItem.quantity : 0;
  const totalReed = availableReed + carriedReed;
  const totalClay = availableClay + carriedClay;
  const availableVessels =
    farmState.type === "ready"
      ? (farmState.snapshot.inventory.find(
          item => item.itemKey === "brewingVessels"
        )?.quantity ?? 0)
      : 0;
  const availableEmptyBeerJars =
    farmState.type === "ready"
      ? (farmState.snapshot.inventory.find(
          item => item.itemKey === "emptyBeerJar"
        )?.quantity ?? 0)
      : 0;
  // Construction consumes the jars from inventory, but they remain installed.
  const missingBrewingJars =
    farmState.type === "ready" &&
    farmState.snapshot.buildings.some(building => building.type === "brewery")
      ? 0
      : Math.max(
          0,
          FARM_BUILDING_DEFINITIONS.brewery.materials.brewingVessels -
            availableVessels
        );
  const hasMill = farmState.type === "ready" &&
    farmState.snapshot.buildings.some(building => building.type === "mill");
  const canBuildMill =
    !hasMill &&
    farmLevel >= 5 &&
    carriedItem === null &&
    !(
      farmState.type === "ready" && farmerProductionJob(farmState.snapshot.farm)
    ) &&
    availableReed >= FARM_BUILDING_DEFINITIONS.mill.materials.reed &&
    availableClay >= FARM_BUILDING_DEFINITIONS.mill.materials.clay;
  const hasBrewery = farmState.type === "ready" &&
    farmState.snapshot.buildings.some(building => building.type === "brewery");
  const canBuildBrewery =
    !hasBrewery &&
    !(
      farmState.type === "ready" && farmerProductionJob(farmState.snapshot.farm)
    ) &&
    farmLevel >= 6 &&
    availableReed >= FARM_BUILDING_DEFINITIONS.brewery.materials.reed &&
    availableClay >= FARM_BUILDING_DEFINITIONS.brewery.materials.clay &&
    availableVessels >=
      FARM_BUILDING_DEFINITIONS.brewery.materials.brewingVessels &&
    carriedItem === null;
  const availableBakingTools =
    farmState.type === "ready"
      ? (farmState.snapshot.inventory.find(
          item => item.itemKey === "bakingTools"
        )?.quantity ?? 0)
      : 0;
  const hasBreadOven = farmState.type === "ready" &&
    farmState.snapshot.buildings.some(building => building.type === "breadOven");
  const canBuildBreadOven =
    !hasBreadOven &&
    !(
      farmState.type === "ready" && farmerProductionJob(farmState.snapshot.farm)
    ) &&
    farmLevel >= 6 &&
    availableReed >= BREAD_OVEN_DEFINITION.materials.reed &&
    availableClay >= BREAD_OVEN_DEFINITION.materials.clay &&
    availableBakingTools >= BREAD_OVEN_DEFINITION.materials.bakingTools &&
    carriedItem === null;
  const granaryCount =
    farmState.type === "ready"
      ? farmState.snapshot.buildings.filter(
          building => building.type === "granary"
        ).length
      : 0;
  const granaryLimitReached =
    farmState.type === "ready" &&
    granaryCount >= granaryLimitForLevel(farmLevel);
  const canBuildGranary =
    !(
      farmState.type === "ready" && farmerProductionJob(farmState.snapshot.farm)
    ) &&
    farmLevel >= 2 &&
    !granaryLimitReached &&
    availableReed >= FARM_BUILDING_DEFINITIONS.granary.materials.reed &&
    availableClay >= FARM_BUILDING_DEFINITIONS.granary.materials.clay;
  const farmBuildingTile = gridStore
    .getState()
    .grid.flat()
    .find(tile => tile?.type === "farm");
  const selectedGranary =
    farmState.type === "ready" &&
    selectedTile?.type === "granary" &&
    farmBuildingTile !== undefined
      ? farmState.snapshot.buildings.find(
          building =>
            building.type === "granary" &&
            building.column ===
              selectedTile.position.column -
                (farmBuildingTile.position.column -
                  INITIAL_FARM_CONFIG.buildingBounds.minimumColumn) &&
            building.row ===
              selectedTile.position.row -
                (farmBuildingTile.position.row -
                  INITIAL_FARM_CONFIG.buildingBounds.minimumRow)
        )
      : undefined;
  const barleyWithdrawalSource = (() => {
    if (farmState.type !== "ready" || farmBuildingTile === undefined) {
      return null;
    }

    if (storedBarley > 0) {
      return {
        storage: "farm" as const,
        target: farmBuildingTile.position
      };
    }

    const granary = farmState.snapshot.buildings.find(
      building =>
        building.type === "granary" &&
        building.storedBarley > 0 &&
        Date.parse(building.completesAt) <= storageClock
    );

    if (granary === undefined) {
      return null;
    }

    const farmColumnOffset =
      farmBuildingTile.position.column -
      INITIAL_FARM_CONFIG.buildingBounds.minimumColumn;
    const farmRowOffset =
      farmBuildingTile.position.row -
      INITIAL_FARM_CONFIG.buildingBounds.minimumRow;
    const granaryTile = gridStore
      .getState()
      .grid.flat()
      .find(
        candidate =>
          candidate?.type === "granary" &&
          candidate.position.column === granary.column + farmColumnOffset &&
          candidate.position.row === granary.row + farmRowOffset
      );

    return granaryTile === undefined
      ? null
      : {
          storage: "granary" as const,
          target: granaryTile.position
        };
  })();
  const storedHouseholdBarley =
    farmState.type === "ready" ? storedBarley + granaryBarley : 0;
  const householdBarleyCapacity =
    farmState.type === "ready"
      ? calculateFarmStorageCapacity(
          farmState.snapshot.buildings,
          storageClock,
          farmLevel
        )
      : FARM_STORAGE_CAPACITY;
  const availableBarleyStorage = Math.max(
    0,
    householdBarleyCapacity - storedHouseholdBarley
  );

  const clearSelection = useStore(
    interactionStore,
    state => state.clearSelection
  );

  const isOpenTilePopover = selectedTile !== null;

  const selectedTileSize =
    selectedTile?.type === "farm" ||
    selectedTile?.type === "granary" ||
    selectedTile?.type === "brewery" ||
    selectedTile?.type === "mill" ||
    selectedTile?.type === "breadOven"
      ? TILE_SIZE * 2
      : TILE_SIZE;

  const showPopoverBelow =
    selectedTile !== null && selectedTile.position.row <= 3;

  const tilePopoverX =
    selectedTile === null
      ? 0
      : selectedTile.position.posX + selectedTileSize / 2;

  const tilePopoverY =
    selectedTile === null
      ? 0
      : selectedTile.position.posY + (showPopoverBelow ? selectedTileSize : 0);

  const addCommand = (command: FarmerCommandInput): void => {
    farmerCommandStore.getState().addCommand(command);
    clearSelection();
  };

  const tradeMarketItem = async (
    direction: "buy" | "sell",
    itemKey: MarketItemKey,
    expectedUnitPrice: number,
    quantity: number
  ): Promise<void> => {
    if (
      farmState.type !== "ready" ||
      marketQuoteState.type !== "ready" ||
      marketTradePending
    ) {
      return;
    }

    setMarketTradePending(true);
    setMarketTradeError(null);

    try {
      const commandBase = {
        itemKey,
        quantity,
        expectedUnitPrice,
        idempotencyKey: crypto.randomUUID(),
        expectedFarmVersion: farmState.snapshot.farm.version
      } as const;
      const snapshot = await match(direction)
        .with("buy", () =>
          executeGameCommand({
            type: "buy_from_npc_market",
            ...commandBase
          })
        )
        .with("sell", () =>
          executeGameCommand({
            type: "sell_to_npc_market",
            ...commandBase
          })
        )
        .exhaustive();
      farmStore.getState().setReady(snapshot);
      setMarketQuoteRefresh(refresh => refresh + 1);
    } catch (error) {
      setMarketTradeError(
        error instanceof Error
          ? error.message
          : "The trade could not be completed"
      );
      setMarketQuoteRefresh(refresh => refresh + 1);
    } finally {
      setMarketTradePending(false);
    }
  };

  const createMarketSellOrder = async (
    itemKey: MarketItemKey,
    unitPrice: number,
    quantity: number
  ): Promise<void> => {
    if (farmState.type !== "ready" || marketTradePending) {
      return;
    }

    setMarketTradePending(true);
    setMarketTradeError(null);

    try {
      const snapshot = await executeGameCommand({
        type: "create_market_sell_order",
        itemKey,
        quantity,
        unitPrice,
        idempotencyKey: crypto.randomUUID(),
        expectedFarmVersion: farmState.snapshot.farm.version
      });
      farmStore.getState().setReady(snapshot);
      setMarketSellPrices(prices => ({ ...prices, [itemKey]: undefined }));
      setMarketQuoteRefresh(refresh => refresh + 1);
    } catch (error) {
      setMarketTradeError(
        error instanceof Error
          ? error.message
          : "The sell order could not be created"
      );
      setMarketQuoteRefresh(refresh => refresh + 1);
    } finally {
      setMarketTradePending(false);
    }
  };

  const cancelMarketSellOrder = async (orderId: string): Promise<void> => {
    if (farmState.type !== "ready" || marketTradePending) {
      return;
    }

    setMarketTradePending(true);
    setMarketTradeError(null);

    try {
      const snapshot = await executeGameCommand({
        type: "cancel_market_sell_order",
        orderId,
        expectedFarmVersion: farmState.snapshot.farm.version
      });
      farmStore.getState().setReady(snapshot);
      setMarketQuoteRefresh(refresh => refresh + 1);
    } catch (error) {
      setMarketTradeError(
        error instanceof Error
          ? error.message
          : "The sell order could not be cancelled"
      );
      setMarketQuoteRefresh(refresh => refresh + 1);
    } finally {
      setMarketTradePending(false);
    }
  };

  const buyPlayerListing = async (
    orderId: string,
    expectedUnitPrice: number,
    quantity: number
  ): Promise<void> => {
    if (farmState.type !== "ready" || marketTradePending) return;
    setMarketTradePending(true);
    setMarketTradeError(null);
    try {
      const snapshot = await executeGameCommand({
        type: "buy_market_sell_order",
        orderId,
        expectedUnitPrice,
        quantity,
        idempotencyKey: crypto.randomUUID(),
        expectedFarmVersion: farmState.snapshot.farm.version
      });
      farmStore.getState().setReady(snapshot);
    } catch (error) {
      setMarketTradeError(
        error instanceof Error
          ? error.message
          : "The purchase could not be completed"
      );
    } finally {
      setMarketTradePending(false);
      setMarketQuoteRefresh(refresh => refresh + 1);
    }
  };

  const isNextToIrrigationSource = (tile: Tile): boolean =>
    Object.values(gridStore.getState().findAdjacentTiles(tile.position)).some(
      adjacentTile =>
        adjacentTile?.type === "water" ||
        adjacentTile?.type.startsWith("canal") === true
    );

  const localTilePosition = (tile: Tile) => ({
    column:
      tile.position.column -
      (farmBuildingTile?.position.column ?? 0) +
      INITIAL_FARM_CONFIG.buildingBounds.minimumColumn,
    row:
      tile.position.row -
      (farmBuildingTile?.position.row ?? 0) +
      INITIAL_FARM_CONFIG.buildingBounds.minimumRow
  });

  const isNextToRiver = (tile: Tile): boolean =>
    farmBuildingTile !== null &&
    farmBuildingTile !== undefined &&
    isGatherableRiverbank(localTilePosition(tile));

  const isNextToIrrigationCanal = (tile: Tile): boolean =>
    Object.values(gridStore.getState().findAdjacentTiles(tile.position)).some(
      adjacentTile => adjacentTile?.type.startsWith("canal") === true
    );

  const buildIrrigationButton = (tile: Tile) => {
    if (farmState.type !== "ready" || !farmBuildingTile) return null;
    if (!isInsideFarmWorld(localTilePosition(tile))) return null;
    const local = {
      column:
        tile.position.column -
        farmBuildingTile.position.column +
        INITIAL_FARM_CONFIG.buildingBounds.minimumColumn,
      row:
        tile.position.row -
        farmBuildingTile.position.row +
        INITIAL_FARM_CONFIG.buildingBounds.minimumRow
    };
    if (isRoadIntersection(local, farmState.snapshot.farm.roads)) return null;
    return (
      <button
        onClick={() =>
          addCommand({
            type: "build",
            target: tile.position,
            build: "irrigation"
          })
        }
      >
        Build Irrigation
      </button>
    );
  };

  const buildRoadButton = (tile: Tile) => {
    if (carriedItem !== null || farmState.type !== "ready" || !farmBuildingTile)
      return null;
    const local = {
      column:
        tile.position.column -
        farmBuildingTile.position.column +
        INITIAL_FARM_CONFIG.buildingBounds.minimumColumn,
      row:
        tile.position.row -
        farmBuildingTile.position.row +
        INITIAL_FARM_CONFIG.buildingBounds.minimumRow
    };
    return validateRoadPlacement(
      local,
      farmState.snapshot.farm.roads,
      new Set()
    ) === null ? (
      <button
        onClick={() =>
          addCommand({ type: "build", build: "road", target: tile.position })
        }
      >
        Build road
      </button>
    ) : null;
  };

  const displayPopoverContent = (tile: typeof selectedTile) => {
    if (
      farmState.type === "ready" &&
      farmState.snapshot.farm.production.planting
    )
      return (
        <p>
          The farmer is working on the selected fields. Finish the job or use
          “Stop after this field” before starting another task.
        </p>
      );
    if (
      tile?.type === "breadOven" &&
      tile.buildingId &&
      farmState.type === "ready"
    )
      return (
        <BreadOvenContent
          snapshot={farmState.snapshot}
          buildingId={tile.buildingId}
          target={tile.position}
          now={storageClock}
          addCommand={addCommand}
        />
      );
    if (
      farmState.type === "ready" &&
      tile &&
      (tile.type === "beerJars" ||
        tile.type === "breadBasket" ||
        (tile.type === "farm" && farmState.snapshot.farm.production.delivery))
    ) {
      const snapshot = farmState.snapshot;
      const delivery = snapshot.farm.production.delivery;
      const buildingId =
        tile.type === "farm" ? delivery?.buildingId : tile.buildingId;
      const stack =
        tile.type === "farm"
          ? delivery
          : snapshot.farm.production.pending[buildingId ?? ""];
      const busy =
        farmerProductionJob(snapshot.farm) ||
        snapshot.farm.millGoods.delivery ||
        snapshot.farm.fishing ||
        snapshot.farm.gathering ||
        carriedItem ||
        (tile.type !== "farm" && delivery);
      return (
        <div className={styles["tile-popover-content"]}>
          <div className={styles["tile-popover-content-header"]}>
            {stack?.itemKey === "bread" ? "Bread basket" : "Beer jars"}
          </div>
          <div className={styles["tile-popover-content-body"]}>
            <p>
              {stack?.quantity ?? 0} {stack?.itemKey ?? "items"} ready to store.
            </p>
            <p>
              The farmer will collect these goods and bring them to the farm.
              Resources update only on delivery.
            </p>
            {busy && <p>Finish the current task and empty your hands first.</p>}
            <button
              disabled={!stack || !buildingId || !!busy}
              onClick={() => {
                if (buildingId)
                  addCommand({
                    type: "production",
                    action: "store",
                    buildingId,
                    target: tile.position
                  });
              }}
            >
              Store
            </button>
          </div>
        </div>
      );
    }
    if (
      tile?.type === "farm" &&
      farmState.type === "ready" &&
      farmState.snapshot.farm.millGoods.delivery
    ) {
      const delivery = farmState.snapshot.farm.millGoods.delivery;
      return (
        <div className={styles["tile-popover-content"]}>
          <div className={styles["tile-popover-content-header"]}>
            Store processed grain
          </div>
          <div className={styles["tile-popover-content-body"]}>
            <p>
              Carrying {delivery.bags.flour} Flour and{" "}
              {delivery.bags.brewersGroats} Brewer's Groats bags.
            </p>
            <button
              onClick={() =>
                addCommand({
                  type: "store_mill_goods",
                  target: tile.position,
                  millId: delivery.millId
                })
              }
            >
              Store
            </button>
          </div>
        </div>
      );
    }
    if (tile?.type === "millBags" && farmState.type === "ready") {
      const snapshot = farmState.snapshot;
      const bags = snapshot.farm.millGoods.pending[tile.millId ?? ""];
      return (
        <div className={styles["tile-popover-content"]}>
          <div className={styles["tile-popover-content-header"]}>
            Processed grain
          </div>
          <div className={styles["tile-popover-content-body"]}>
            <p>Flour bags: {bags?.flour ?? 0}</p>
            <p>Brewer's Groats bags: {bags?.brewersGroats ?? 0}</p>
            <p>
              The farmer will carry all these bags to the farm to add them to
              Resources.
            </p>
            {carriedItem && <p>Empty the farmer's hands first.</p>}
            <button
              disabled={
                !bags ||
                !!carriedItem ||
                !!farmerProductionJob(snapshot.farm) ||
                !!snapshot.farm.millGoods.delivery
              }
              onClick={() => {
                if (tile.millId)
                  addCommand({
                    type: "store_mill_goods",
                    target: tile.position,
                    millId: tile.millId
                  });
              }}
            >
              Store
            </button>
          </div>
        </div>
      );
    }
    if (tile?.type === "mill" && farmState.type === "ready")
      return (
        <MillContent
          snapshot={farmState.snapshot}
          target={tile.position}
          now={storageClock}
          addCommand={addCommand}
        />
      );
    if (
      farmState.type === "ready" &&
      farmerProductionJob(farmState.snapshot.farm)
    )
      return (
        <div className={styles["tile-popover-content"]}>
          <div className={styles["tile-popover-content-header"]}>
            Farmer busy
          </div>
          <p>
            The farmer is busy milling or baking. <br />
            Wait for production to finish before starting another task.
          </p>
        </div>
      );
    if (!tile) return <span>No tile selected</span>;
    if (farmState.type === "ready" && farmState.snapshot.farm.fishing)
      return (
        <p>
          Fishing in progress. Cast in the highlighted river or choose Stop
          fishing.
        </p>
      );
    if (carriedItem?.itemKey === "fish") {
      const stored =
        farmState.type === "ready"
          ? (farmState.snapshot.inventory.find(item => item.itemKey === "fish")
              ?.quantity ?? 0)
          : 0;
      return (
        <div className={styles["tile-popover-content"]}>
          <div className={styles["tile-popover-content-header"]}>
            {tile.type === "farm"
              ? "Farm"
              : tile.type === "water"
                ? "River"
                : "Carrying a fish"}
          </div>
          {tile.type === "farm" ? (
            <>
              <p>
                Fish: {stored} / {FISH_CAPACITY}
              </p>
              {stored < FISH_CAPACITY ? (
                <button
                  onClick={() =>
                    addCommand({
                      type: "fishing",
                      action: "store",
                      target: tile.position
                    })
                  }
                >
                  Store fish
                </button>
              ) : (
                <p role="alert">
                  Fish storage is full. Release the fish at the river.
                </p>
              )}
            </>
          ) : tile.type === "water" ? (
            <button
              onClick={() =>
                addCommand({
                  type: "fishing",
                  action: "release",
                  target: tile.position
                })
              }
            >
              Release fish
            </button>
          ) : (
            <p>Bring the fish to the farm or release it at the river.</p>
          )}
        </div>
      );
    }

    if (carriedItem?.itemKey === "water" && tile.type !== "brewery") {
      const canPour = [
        "ground",
        "groundVariant",
        "water",
        "canalBridge",
        "canalHorizontal",
        "canalVertical",
        "canalCorner",
        "canalCross",
        "canalTJunction"
      ].includes(tile.type);
      return (
        <div className={styles["tile-popover-content"]}>
          <div className={styles["tile-popover-content-header"]}>
            Selected tile
          </div>
          <div className={styles["tile-popover-content-body"]}>
            {canPour ? (
              <button
                onClick={() =>
                  addCommand({
                    type: "brewery_supply",
                    action: "pour_water",
                    target: tile.position
                  })
                }
              >
                Pour out water
              </button>
            ) : (
              "No available actions."
            )}
          </div>
        </div>
      );
    }

    return match(tile.type)
      .with("groundPathHorizontal", () => (
        <div className={styles["tile-popover-content"]}>
          <div className={styles["tile-popover-content-header"]}>
            <span className="cuneiforms">𒆜</span>
            Road
          </div>
          <div className={styles["tile-popover-content-body"]}>
            <span>A road connecting buildings and their loading points.</span>
            <button
              onClick={() =>
                addCommand({ type: "move", target: tile.position })
              }
            >
              Walk
            </button>
            {carriedItem === null &&
              tile.position.row === INITIAL_FARM_CONFIG.roadRow &&
              isNextToIrrigationSource(tile) &&
              buildIrrigationButton(tile)}
          </div>
        </div>
      ))
      .with("ground", () => {
        if (farmBuildingTile && !isInsideFarmWorld(localTilePosition(tile)))
          return (
            <div className={styles["tile-popover-content"]}>
              <div className={styles["tile-popover-content-header"]}>
                Ground
              </div>
              <div className={styles["tile-popover-content-body"]}>
                This scenery is outside your farm. Collect resources and build
                inside the farm boundary.
              </div>
            </div>
          );
        const isRiverBank = isNextToRiver(tile);
        const canBuildIrrigation =
          carriedItem === null && isNextToIrrigationSource(tile);

        return (
          <div className={styles["tile-popover-content"]}>
            <div className={styles["tile-popover-content-header"]}>
              <span className="cuneiforms">𒅖</span>
              <span>Ground</span>
            </div>
            <div className={styles["tile-popover-content-body"]}>
              Dry soil, nothing can grow here
              {isRiverBank && (
                <button
                  disabled={carriedItem !== null}
                  onClick={() =>
                    addCommand({
                      type: "gather",
                      target: tile.position,
                      item: "clay"
                    })
                  }
                >
                  {carriedItem === null
                    ? "Collect Clay"
                    : "Empty your hands first"}
                </button>
              )}
              {canBuildIrrigation && buildIrrigationButton(tile)}
              {carriedItem === null && !isRiverBank && !canBuildIrrigation && (
                <button
                  onClick={() =>
                    addCommand({
                      type: "inspect",
                      target: tile
                    })
                  }
                >
                  Inspect
                </button>
              )}
              {buildRoadButton(tile)}
            </div>
          </div>
        );
      })
      .with("groundVariant", () => {
        const canBuildIrrigation =
          carriedItem === null && isNextToIrrigationSource(tile);
        const isIrrigated = isNextToIrrigationCanal(tile);
        const canPlantBarley = carriedItem?.itemKey === "barley" && isIrrigated;
        const canRetrieveBarley =
          carriedItem === null &&
          barleyWithdrawalSource !== null &&
          isIrrigated;
        const canDropCarriedItem = carriedItem !== null;
        const hasTileAction =
          isIrrigated || canBuildIrrigation || canDropCarriedItem;

        return (
          <div className={styles["tile-popover-content"]}>
            <div className={styles["tile-popover-content-header"]}>
              <span className="cuneiforms">𒄒</span>
              <span>Arable ground</span>
            </div>
            <div className={styles["tile-popover-content-body"]}>
              <span>Fertile soil suitable for farming.</span>
              {!isIrrigated && (
                <span>
                  Build an irrigation canal next to this tile and connect it to
                  the river to grow barley here.
                </span>
              )}
              {farmState.type === "ready" &&
                plantableFields(farmState.snapshot, storageClock).length >=
                  2 && (
                  <button
                    disabled={
                      (carriedItem !== null && carriedItem.itemKey !== "barley") ||
                      farmerCommandStore.getState().status.type !== "idle" ||
                      !!farmState.snapshot.farm.production.planting
                    }
                    onClick={() => {
                      clearSelection();
                      batchPlantingStore.getState().start();
                    }}
                  >
                    Plant multiple fields
                  </button>
                )}
              {canPlantBarley && (
                <button
                  onClick={() =>
                    addCommand({
                      type: "plant",
                      target: tile.position,
                      crop: "barley"
                    })
                  }
                >
                  Plant Barley
                </button>
              )}
              {canRetrieveBarley && (
                <button
                  onClick={() =>
                    addCommand({
                      type: "withdraw",
                      target: barleyWithdrawalSource.target,
                      item: "barley",
                      storage: barleyWithdrawalSource.storage
                    })
                  }
                >
                  Get barley from the {barleyWithdrawalSource.storage}
                </button>
              )}
              {isIrrigated &&
                carriedItem === null &&
                barleyWithdrawalSource === null && (
                  <button disabled>No stored barley available</button>
                )}
              {isIrrigated &&
                carriedItem !== null &&
                carriedItem.itemKey !== "barley" &&
                carriedItem.itemKey !== "reed" && (
                  <button disabled>Empty your hands before planting</button>
                )}
              {canDropCarriedItem && (
                <button
                  onClick={() =>
                    addCommand({
                      type: "drop",
                      target: tile.position
                    })
                  }
                >
                  Drop 1 {carriedItem.itemKey}
                </button>
              )}
              {canBuildIrrigation && buildIrrigationButton(tile)}
              {buildRoadButton(tile)}
              {!hasTileAction && (
                <button
                  onClick={() =>
                    addCommand({
                      type: "inspect",
                      target: tile
                    })
                  }
                >
                  Inspect
                </button>
              )}
            </div>
          </div>
        );
      })
      .with("harvestedBarley", () => (
        <div className={styles["tile-popover-content"]}>
          <div className={styles["tile-popover-content-header"]}>
            <span className="cuneiforms">𒊺</span>
            <span>Barley</span>
          </div>
          <div className={styles["tile-popover-content-body"]}>
            What would you like to do?
            <span>Unstored barley perishes after 3 days.</span>
            <button
              disabled={
                carriedItem !== null &&
                (carriedItem.itemKey !== "barley" ||
                  carriedItem.quantity >= FARMER_CARRY_CAPACITY)
              }
              onClick={() =>
                addCommand({
                  type: "pickup",
                  target: tile.position,
                  item: "barley"
                })
              }
            >
              {carriedItem === null ||
              (carriedItem.itemKey === "barley" &&
                carriedItem.quantity < FARMER_CARRY_CAPACITY)
                ? "Pick Up"
                : "Cannot carry more"}
            </button>
          </div>
        </div>
      ))
      .with("reedBundle", "brickPile", groundItemType => {
        const item = groundItemType === "reedBundle" ? "reed" : "clay";
        const groundItem =
          farmState.type === "ready" && farmBuildingTile !== undefined
            ? farmState.snapshot.groundItems.find(
                entry =>
                  entry.itemKey === item &&
                  entry.column ===
                    tile.position.column -
                      (farmBuildingTile.position.column -
                        INITIAL_FARM_CONFIG.buildingBounds.minimumColumn) &&
                  entry.row ===
                    tile.position.row -
                      (farmBuildingTile.position.row -
                        INITIAL_FARM_CONFIG.buildingBounds.minimumRow)
              )
            : undefined;
        const destroy = async () => {
          if (
            destroyMaterialPending ||
            !groundItem ||
            farmState.type !== "ready"
          )
            return;
          setDestroyMaterialPending(true);
          setDestroyMaterialError(null);
          try {
            const snapshot = await executeGameCommand({
              type: "destroy_ground_material",
              groundItemId: groundItem.id,
              expectedFarmVersion: farmState.snapshot.farm.version
            });
            const current = farmStore.getState().farm;
            if (
              current.type === "ready" &&
              current.snapshot.farm.id === snapshot.farm.id
            ) {
              farmStore.getState().setReady(snapshot);
              if (interactionStore.getState().selectedTile?.id === tile.id)
                interactionStore.getState().clearSelection();
            }
          } catch (error) {
            setDestroyMaterialError({
              id: groundItem.id,
              message:
                error instanceof Error
                  ? error.message
                  : "The material could not be destroyed."
            });
          } finally {
            setDestroyMaterialPending(false);
          }
        };

        return (
          <div className={styles["tile-popover-content"]}>
            <div className={styles["tile-popover-content-header"]}>
              <span>{item === "reed" ? "Reed bundle" : "Clay bricks"}</span>
            </div>
            <div className={styles["tile-popover-content-body"]}>
              Building material left on the arable ground
              <span>
                Destroy permanently removes this pile and all its materials.
              </span>
              {destroyMaterialError?.id === groundItem?.id &&
                destroyMaterialError && (
                  <span role="alert">{destroyMaterialError.message}</span>
                )}
              <button
                disabled={carriedItem !== null || destroyMaterialPending}
                onClick={() =>
                  addCommand({
                    type: "pickup",
                    target: tile.position,
                    item
                  })
                }
              >
                {carriedItem === null ? "Pick Up" : "Empty your hands first"}
              </button>
              <button
                disabled={destroyMaterialPending || !groundItem}
                onClick={() => {
                  void destroy();
                }}
              >
                {destroyMaterialPending ? "Destroying…" : "Destroy"}
              </button>
            </div>
          </div>
        );
      })
      .with("reeds", () => (
        <div className={styles["tile-popover-content"]}>
          <div className={styles["tile-popover-content-header"]}>
            <span>River reeds</span>
          </div>
          <div className={styles["tile-popover-content-body"]}>
            Reeds suitable for construction
            <button
              disabled={carriedItem !== null}
              onClick={() =>
                addCommand({
                  type: "gather",
                  target: tile.position,
                  item: "reed"
                })
              }
            >
              {carriedItem === null
                ? "Collect Reeds"
                : "Empty your hands first"}
            </button>
          </div>
        </div>
      ))
      .with("barleySeeded", () => (
        <div className={styles["tile-popover-content"]}>
          <div className={styles["tile-popover-content-header"]}>
            <span className="cuneiforms">𒊺</span>
            <span>Seeded barley</span>
          </div>
          <div className={styles["tile-popover-content-body"]}>
            The barley has just been planted
          </div>
        </div>
      ))
      .with("barleyGrowing", () => {
        const crop =
          farmState.type === "ready" && farmBuildingTile !== undefined
            ? farmState.snapshot.crops.find(
                entry =>
                  entry.column ===
                    tile.position.column -
                      (farmBuildingTile.position.column -
                        INITIAL_FARM_CONFIG.buildingBounds.minimumColumn) &&
                  entry.row ===
                    tile.position.row -
                      (farmBuildingTile.position.row -
                        INITIAL_FARM_CONFIG.buildingBounds.minimumRow)
              )
            : undefined;
        const duration = crop
          ? Date.parse(crop.growthCompletesAt) - Date.parse(crop.plantedAt)
          : 0;
        const progress =
          crop && duration > 0
            ? Math.min(
                100,
                Math.max(
                  0,
                  ((storageClock - Date.parse(crop.plantedAt)) / duration) * 100
                )
              )
            : 0;
        return (
          <div className={styles["tile-popover-content"]}>
            <div className={styles["tile-popover-content-header"]}>
              <span className="cuneiforms">𒊺</span>
              <span>Growing barley</span>
            </div>
            <div className={styles["tile-popover-content-body"]}>
              The barley is still growing
              <progress
                className={styles["crop-growth-progress"]}
                value={progress}
                max={100}
                aria-label="Barley growth"
                aria-valuetext={`${Math.floor(progress)}% grown`}
              />
            </div>
          </div>
        );
      })
      .with("barleyReady", () => (
        <div className={styles["tile-popover-content"]}>
          <div className={styles["tile-popover-content-header"]}>
            <span className="cuneiforms">𒊺</span>
            <span>Ripe barley</span>
          </div>
          <div className={styles["tile-popover-content-body"]}>
            The barley is ready to harvest
            <button
              disabled={carriedItem !== null}
              onClick={() =>
                addCommand({
                  type: "harvest",
                  target: tile.position
                })
              }
            >
              {carriedItem === null
                ? "Harvest Barley"
                : "Empty your hands first"}
            </button>
            {farmState.type === "ready" &&
              harvestableFields(farmState.snapshot, storageClock).length >=
                2 && (
                <button
                  disabled={
                    carriedItem !== null ||
                    farmerCommandStore.getState().status.type !== "idle"
                  }
                  onClick={() => {
                    clearSelection();
                    batchPlantingStore.getState().start("harvest");
                  }}
                >
                  Harvest multiple fields
                </button>
              )}
          </div>
        </div>
      ))
      .with("farm", () => (
        <div className={styles["tile-popover-content"]}>
          <div className={styles["tile-popover-content-header"]}>
            <span className="cuneiforms">𒂍</span>
            <span>Farm</span>
          </div>
          <div className={styles["tile-popover-content-body"]}>
            A building used for agricultural activities
            <span>
              Stored barley: {storedBarley} / {FARM_STORAGE_CAPACITY}
            </span>
            {farmLevel >= 4 && (
              <span>
                Stored fish:{" "}
                {farmState.type === "ready"
                  ? (farmState.snapshot.inventory.find(
                      item => item.itemKey === "fish"
                    )?.quantity ?? 0)
                  : 0}{" "}
                / {FISH_CAPACITY}
              </span>
            )}
            {carriedItem?.itemKey === "barley" && (
              <button
                disabled={storedBarley >= FARM_STORAGE_CAPACITY}
                onClick={() =>
                  addCommand({
                    type: "deposit",
                    target: tile.position,
                    storage: "farm"
                  })
                }
              >
                {storedBarley >= FARM_STORAGE_CAPACITY
                  ? "Farm storage is full"
                  : "Store Barley"}
              </button>
            )}
            {carriedItem === null && (
              <button
                disabled={storedBarley === 0}
                onClick={() =>
                  addCommand({
                    type: "withdraw",
                    target: tile.position,
                    item: "barley",
                    storage: "farm"
                  })
                }
              >
                {storedBarley === 0 ? "Farm storage is empty" : "Take 1 Barley"}
              </button>
            )}
          </div>
        </div>
      ))
      .with("brewery", () => {
        const brewery =
          farmState.type === "ready" && farmBuildingTile !== undefined
            ? farmState.snapshot.buildings.find(
                building =>
                  building.type === "brewery" &&
                  building.column ===
                    tile.position.column -
                      (farmBuildingTile.position.column -
                        INITIAL_FARM_CONFIG.buildingBounds.minimumColumn) &&
                  building.row ===
                    tile.position.row -
                      (farmBuildingTile.position.row -
                        INITIAL_FARM_CONFIG.buildingBounds.minimumRow)
              )
            : undefined;
        const complete =
          brewery !== undefined &&
          Date.parse(brewery.completesAt) <= storageClock;
        const brewing = getBrewingState(
          brewery?.beerReadyAt ?? null,
          storageClock
        );
        const readyBeer =
          brewery === undefined ? 0 : readyBeerQuantity(brewery, storageClock);
        const household =
          farmState.type === "ready" ? farmState.snapshot.farm.household : null;
        const lastBeerAt = household?.lastBeerAt
          ? Date.parse(household.lastBeerAt)
          : null;
        const beerQuantity =
          farmState.type === "ready"
            ? (farmState.snapshot.inventory.find(
                item => item.itemKey === "beer"
              )?.quantity ?? 0)
            : 0;
        const treatRule = validateBeerTreat(
          readyBeer + beerQuantity,
          household?.happiness ?? 100,
          lastBeerAt,
          storageClock
        );
        const brewRule =
          brewery === undefined
            ? null
            : validateBrewing(
                "start_brewing",
                brewery,
                storageClock,
                farmState.type === "ready"
                  ? (farmState.snapshot.inventory.find(
                      i => i.itemKey === "brewersGroats"
                    )?.quantity ?? 0)
                  : 0
              );
        const canDeliver = complete && carriedItem?.itemKey === "water";
        const full =
          carriedItem !== null &&
          brewery !== undefined &&
          carriedItem.itemKey === "water" &&
          brewery.brewingWater + carriedItem.quantity > BREWERY_WATER_CAPACITY;
        const deliveryButton = canDeliver && (
          <button
            disabled={full}
            onClick={() =>
              addCommand({
                type: "brewery_supply",
                action: "deliver",
                target: tile.position
              })
            }
          >
            {full
              ? "Brewery water supply is full"
              : `Deliver ${carriedItem.itemKey}`}
          </button>
        );
        return (
          <div className={styles["tile-popover-content"]}>
            <div className={styles["tile-popover-content-header"]}>
              <span className="cuneiforms">𒂍𒋆</span>
              <span>Brewery</span>
            </div>
            <div className={styles["tile-popover-content-body"]}>
              {!complete ? (
                "Under construction"
              ) : (
                <>
                  <span>
                    Water: {brewery.brewingWater} / {BREWERY_WATER_CAPACITY}{" "}
                    loads
                  </span>
                  <span>
                    Stored Brewer's Groats:{" "}
                    {farmState.type === "ready"
                      ? (farmState.snapshot.inventory.find(
                          i => i.itemKey === "brewersGroats"
                        )?.quantity ?? 0)
                      : 0}{" "}
                    / {BEER_RECIPE.groats}
                  </span>
                  <span>
                    2 groats + 2 water loads + 2 empty jars → 2 beer · 15
                    minutes. Groats are consumed from estate inventory when
                    brewing starts.
                  </span>
                  <span>
                    Empty beer jars: {brewery.emptyBeerJars} /{" "}
                    {BREWERY_EMPTY_JAR_CAPACITY}
                  </span>
                  {match(brewing)
                    .with({ type: "idle" }, () =>
                      brewRule === null ? null : (
                        <span>{brewingErrors[brewRule]}</span>
                      )
                    )
                    .with({ type: "brewing" }, ({ readyAt }) => {
                      const seconds = Math.max(
                        0,
                        Math.ceil((readyAt - storageClock) / 1000)
                      );
                      return (
                        <span>
                          Brewing: {Math.floor(seconds / 60)}:
                          {String(seconds % 60).padStart(2, "0")} remaining
                        </span>
                      );
                    })
                    .with({ type: "ready" }, () => (
                      <span>
                        {readyBeer} beer {readyBeer === 1 ? "jar" : "jars"}{" "}
                        ready. Use Store on the jars beside the brewery.
                      </span>
                    ))
                    .exhaustive()}
                  {carriedItem?.itemKey === "water" && deliveryButton}
                  {treatRule === null ? (
                    <button
                      onClick={() =>
                        addCommand({
                          type: "brewery_supply",
                          action: "give_beer",
                          target: tile.position
                        })
                      }
                    >
                      Give 1 beer to the farmer (+15 happiness)
                    </button>
                  ) : null}
                  {match(brewing)
                    .with({ type: "idle" }, () => (
                      <>
                        {brewRule === null ? (
                          <button
                            onClick={() =>
                              addCommand({
                                type: "brewery_supply",
                                action: "start_brewing",
                                target: tile.position
                              })
                            }
                          >
                            Start brewing
                          </button>
                        ) : null}
                      </>
                    ))
                    .with({ type: "brewing" }, () => null)
                    .with({ type: "ready" }, () => null)
                    .exhaustive()}
                  {carriedItem === null &&
                  availableEmptyBeerJars === 0 &&
                  brewery.emptyBeerJars < BREWERY_EMPTY_JAR_CAPACITY ? (
                    <button
                      type="button"
                      onClick={() => {
                        clearSelection();
                        marketUiStore.getState().openMarket("beer");
                      }}
                    >
                      Buy empty beer jars at the market{" "}
                      <ExternalLinkIcon
                        aria-hidden="true"
                        style={{
                          width: "1em",
                          height: "1em",
                          verticalAlign: "middle"
                        }}
                      />
                    </button>
                  ) : (
                    carriedItem === null && (
                      <button
                        disabled={
                          brewery.emptyBeerJars >= BREWERY_EMPTY_JAR_CAPACITY
                        }
                        onClick={() =>
                          addCommand({
                            type: "brewery_supply",
                            action: "stock_jars",
                            target: tile.position
                          })
                        }
                      >
                        {brewery.emptyBeerJars >= BREWERY_EMPTY_JAR_CAPACITY
                          ? "Beer jar storage is full"
                          : `Transfer ${Math.min(availableEmptyBeerJars, BREWERY_EMPTY_JAR_CAPACITY - brewery.emptyBeerJars)} empty beer jars from estate inventory`}
                      </button>
                    )
                  )}
                  {carriedItem?.itemKey !== "water" && deliveryButton}
                </>
              )}
            </div>
          </div>
        );
      })
      .with("granary", () => (
        <div className={styles["tile-popover-content"]}>
          <div className={styles["tile-popover-content-header"]}>
            <span className="cuneiforms">𒉌𒁾</span>
            <span>Granary</span>
          </div>
          <div className={styles["tile-popover-content-body"]}>
            Adds {granaryCapacityForLevel(farmLevel)} barley storage.
            {selectedGranary !== undefined &&
              Date.parse(selectedGranary.completesAt) <= storageClock && (
                <>
                  <span>
                    Stored barley: {selectedGranary.storedBarley} /{" "}
                    {granaryCapacityForLevel(farmLevel)}
                  </span>
                  {carriedItem?.itemKey === "barley" && (
                    <button
                      disabled={
                        selectedGranary.storedBarley >=
                        granaryCapacityForLevel(farmLevel)
                      }
                      onClick={() =>
                        addCommand({
                          type: "deposit",
                          target: tile.position,
                          storage: "granary"
                        })
                      }
                    >
                      {selectedGranary.storedBarley >=
                      granaryCapacityForLevel(farmLevel)
                        ? "Granary is full"
                        : "Store Barley"}
                    </button>
                  )}
                  {selectedGranary.storedBarley === 0 &&
                    carriedItem?.itemKey !== "barley" && (
                      <p role="alert" className={styles["tile-popover-alert"]}>
                        <ExclamationTriangleIcon />
                        <span style={{ marginLeft: "0.5rem" }}>
                          Granary is empty
                        </span>
                      </p>
                    )}
                  {carriedItem === null && selectedGranary.storedBarley > 0 && (
                    <button
                      onClick={() =>
                        addCommand({
                          type: "withdraw",
                          target: tile.position,
                          item: "barley",
                          storage: "granary"
                        })
                      }
                    >
                      Take 1 Barley
                    </button>
                  )}
                </>
              )}
          </div>
        </div>
      ))
      .with("water", () => (
        <div className={styles["tile-popover-content"]}>
          <div className={styles["tile-popover-content-header"]}>
            <span className="cuneiforms">𒀀</span>
            <span>Water</span>
          </div>
          <div className={styles["tile-popover-content-body"]}>
            A body of water
            {farmLevel < 4 && <p>Fishing unlocks at farm level 4.</p>}
            {carriedItem === null &&
              farmLevel >= 4 &&
              farmState.type === "ready" &&
              ((farmState.snapshot.inventory.find(
                item => item.itemKey === "fish"
              )?.quantity ?? 0) < FISH_CAPACITY ? (
                <button
                  onClick={() =>
                    addCommand({
                      type: "fishing",
                      action: "start",
                      target: tile.position
                    })
                  }
                >
                  Go fishing
                </button>
              ) : (
                <p role="alert">Fish storage is full</p>
              ))}
            {carriedItem === null &&
              farmState.type === "ready" &&
              farmState.snapshot.buildings.some(
                building =>
                  building.type === "brewery" &&
                  Date.parse(building.completesAt) <= storageClock
              ) && (
                <button
                  onClick={() =>
                    addCommand({
                      type: "brewery_supply",
                      action: "collect_water",
                      target: tile.position
                    })
                  }
                >
                  Collect water
                </button>
              )}
          </div>
        </div>
      ))
      .with(
        "canalBridge",
        "canalHorizontal",
        "canalVertical",
        "canalCorner",
        "canalCross",
        "canalTJunction",
        () => (
          <div className={styles["tile-popover-content"]}>
            <div className={styles["tile-popover-content-header"]}>
              <span className="cuneiforms">𒀀</span>
              <span>Irrigation canal</span>
            </div>
            <div className={styles["tile-popover-content-body"]}>
              A canal carrying water toward the fields
              <button
                onClick={() =>
                  addCommand({
                    type: "destroy",
                    target: tile.position,
                    build: "irrigation"
                  })
                }
              >
                Destroy
              </button>
            </div>
          </div>
        )
      )
      .with("farmerIdle0", () => (
        <div className={styles["tile-popover-content"]}>
          <div className={styles["tile-popover-content-header"]}>
            <span className="cuneiforms">𒀳</span>
            <span>Farmer</span>
          </div>
          <div className={styles["tile-popover-content-body"]}>
            {carriedItem === null
              ? "A farmer tending to the fields"
              : `Carrying ${carriedItem.quantity} ${carriedItem.itemKey}`}
            {farmState.type === "ready" && (
              <>
                <div className={styles["farmer-metrics"]}>
                  <div>
                    <HappinessMeter
                      value={farmState.snapshot.farm.household.happiness}
                    />
                    <span>Happiness</span>
                  </div>
                  <div>
                    <RationMeter
                      nextRationAt={
                        farmState.snapshot.farm.household
                          .nextBarleyConsumptionAt
                      }
                      hungry={
                        farmState.snapshot.farm.household.hungrySince !== null
                      }
                      now={storageClock}
                    />
                    <span>Next meal</span>
                  </div>
                </div>
                {(farmState.snapshot.farm.household.hungrySince !== null ||
                  getFarmerMood(farmState.snapshot.farm.household.happiness) ===
                    "unhappy") && (
                  <span>
                    {farmState.snapshot.farm.household.hungrySince !== null
                      ? "I'm hungry and walking slowly. Store barley in the farm or a completed granary so I can eat."
                      : "I'm unhappy and walking a little more slowly."}
                  </span>
                )}
              </>
            )}
            {farmState.type === "ready" &&
              farmState.snapshot.farm.carriedItem?.itemKey === "barley" &&
              farmState.snapshot.farm.carriedItem.expiresAt !== null && (
                <span>
                  Barley perishes in{" "}
                  {formatRemainingTime(
                    farmState.snapshot.farm.carriedItem.expiresAt,
                    storageClock
                  )}
                </span>
              )}
          </div>
        </div>
      ))
      .otherwise(() => <span>Unknown tile</span>);
  };

  useEffect(() => {
    if (!isOpenMarketDialog) {
      return;
    }

    const controller = new AbortController();

    void Promise.all([
      fetchMarketQuotes(controller.signal),
      fetchDevelopmentFarm(controller.signal)
    ]).then(
      ([quotes, snapshot]) => {
        if (controller.signal.aborted) return;
        const current = farmStore.getState().farm;
        if (
          current.type !== "ready" ||
          current.snapshot.farm.version < snapshot.farm.version
        ) {
          farmStore.getState().setReady(snapshot);
        }
        setMarketQuoteState({ type: "ready", quotes });
      },
      error => {
        if (controller.signal.aborted) return;
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setMarketQuoteState({
          type: "failed",
          reason:
            error instanceof Error
              ? error.message
              : "The current market prices could not be loaded"
        });
      }
    );

    return () => {
      controller.abort();
    };
  }, [isOpenMarketDialog, marketQuoteRefresh]);

  useEffect(() => {
    if (!isOpenMarketDialog || marketTradePending) return;
    const refresh = () => setMarketQuoteRefresh(value => value + 1);
    const timer = window.setInterval(refresh, 5_000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [isOpenMarketDialog, marketTradePending]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const controller = new AbortController();
    let pending = false;
    const refresh = async () => {
      if (
        pending ||
        document.visibilityState === "hidden" ||
        farmStore.getState().farm.type !== "ready"
      )
        return;
      pending = true;
      const beforeRefresh = farmStore.getState().farm;
      try {
        const snapshot = await fetchDevelopmentFarm(controller.signal);
        const current = farmStore.getState().farm;
        if (
          !controller.signal.aborted &&
          current.type === "ready" &&
          snapshot.farm.id === current.snapshot.farm.id &&
          (snapshot.farm.version > current.snapshot.farm.version ||
            (current === beforeRefresh &&
              snapshot.farm.version === current.snapshot.farm.version &&
              snapshot.farm.household.happiness !==
                current.snapshot.farm.household.happiness))
        ) {
          farmStore.getState().setReady(snapshot);
        }
      } catch (error) {
        if (!controller.signal.aborted)
          console.error("Failed to refresh player state", error);
      } finally {
        pending = false;
      }
    };
    const timer = window.setInterval(() => {
      void refresh();
    }, 15_000);
    window.addEventListener("focus", refresh);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  useEffect(() => {
    const refreshClock = (): void => setStorageClock(Date.now());
    const timer = window.setInterval(refreshClock, 1_000);
    window.addEventListener("focus", refreshClock);
    document.addEventListener("visibilitychange", refreshClock);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshClock);
      document.removeEventListener("visibilitychange", refreshClock);
    };
  }, []);

  useEffect(() => {
    if (farmState.type !== "ready") {
      return;
    }

    const now = Date.now();
    const nextCompletion = farmState.snapshot.buildings
      .map(building => Date.parse(building.completesAt))
      .filter(completesAt => completesAt > now)
      .toSorted((first, second) => first - second)[0];

    if (nextCompletion === undefined) {
      return;
    }

    const timer = window.setTimeout(
      () => {
        setStorageClock(Date.now());
      },
      nextCompletion - now + 25
    );

    return () => {
      window.clearTimeout(timer);
    };
  }, [farmState]);

  useEffect(() => {
    if (farmState.type !== "ready") return;
    const productionDeadlines = [
      farmState.snapshot.farm.milling?.completesAt,
      ...farmState.snapshot.buildings.map(b => b.beerReadyAt),
      ...Object.values(farmState.snapshot.farm.production.baking).map(
        job => job.completesAt
      )
    ]
      .filter((value): value is string => !!value)
      .map(Date.parse);
    if (productionDeadlines.length === 0) return;
    const controller = new AbortController();
    let timer: number;
    const refresh = () => {
      void fetchDevelopmentFarm(controller.signal)
        .then(snapshot => {
          if (!controller.signal.aborted)
            farmStore.getState().setReady(snapshot);
        })
        .catch(() => {
          if (!controller.signal.aborted)
            timer = window.setTimeout(refresh, 2_000);
        });
    };
    timer = window.setTimeout(
      refresh,
      Math.max(50, Math.min(...productionDeadlines) - Date.now() + 50)
    );
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [farmState]);

  useEffect(() => {
    if (farmState.type !== "ready" || !import.meta.env.DEV) {
      return;
    }

    const snapshot = farmState.snapshot;
    const deadlines = [
      snapshot.farm.household.nextBarleyConsumptionAt,
      snapshot.farm.carriedItem?.expiresAt ?? null,
      ...snapshot.groundItems.map(item => item.expiresAt)
    ]
      .filter((deadline): deadline is string => deadline !== null)
      .map(Date.parse)
      .filter(deadline => Number.isFinite(deadline));
    const nextDeadline = deadlines.toSorted(
      (first, second) => first - second
    )[0];

    if (nextDeadline === undefined) {
      return;
    }

    const timer = window.setTimeout(
      () => {
        void fetchDevelopmentFarm()
          .then(nextSnapshot => {
            farmStore.getState().setReady(nextSnapshot);
          })
          .catch(error => {
            console.error("Failed to refresh the farm lifecycle", error);
          });
      },
      Math.max(0, nextDeadline - Date.now() + 50)
    );

    return () => {
      window.clearTimeout(timer);
    };
  }, [farmState]);

  useEffect(() => {
    let game: Phaser.Game | null = null;
    let disposed = false;

    const startGame = async (): Promise<void> => {
      farmStore.getState().setLoading();

      if (!import.meta.env.DEV) {
        return;
      }

      const farmSnapshot = await fetchDevelopmentFarm();

      if (!disposed) {
        farmStore.getState().setReady(farmSnapshot);
        farmerCommandStore
          .getState()
          .setCarriedItem(farmSnapshot.farm.carriedItem);
        game = createGame(new MainScene(farmSnapshot));
      }
    };

    void startGame().catch(error => {
      console.error("Failed to start the game", error);
      farmStore
        .getState()
        .setFailed(
          error instanceof Error ? error.message : "The farm could not load"
        );
    });

    return () => {
      disposed = true;
      game?.destroy(true);
    };
  }, []);

  return (
    <>
      {!marketSceneVisible && <FishingControls />}
      <FarmLevelDialog />
      {farmLevel >= 7 && <MerchantRequests />}
      <Dialog.Root
        open={isOpenManageDialog && !marketSceneVisible}
        onOpenChange={setIsOpenManageDialog}
      >
        <div ref={setCanvasBoundary} className={styles["canvas"]}>
          {!marketSceneVisible && <FetchControls boundary={canvasBoundary} />}
          {!marketSceneVisible && !fetchActive && (
            <div className={styles["buttons-container"]}>
              <Dialog.Trigger asChild>
                <button className="with-shadow" style={{ padding: "8px 16px" }}>
                  🏺 Manage
                </button>
              </Dialog.Trigger>
            </div>
          )}
          <div id={GAME_CONTAINER_ID} className={styles["game-container"]} />
          {!marketSceneVisible && <BatchPlantingControls now={storageClock} />}
          <Popover.Root
            key={selectedTile?.id ?? "no-selection"}
            open={isOpenTilePopover && !marketSceneVisible}
            onOpenChange={open => {
              if (!open) {
                clearSelection();
              }
            }}
          >
            <Popover.Anchor asChild>
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  left: tilePopoverX,
                  top: tilePopoverY,
                  width: 0,
                  height: 0,
                  pointerEvents: "none"
                }}
              />
            </Popover.Anchor>

            <Popover.Portal>
              <Popover.Content
                className={styles["tile-popover"]}
                style={{
                  maxWidth: `min(${TILE_SIZE * 5}px, calc(100vw - 24px), var(--radix-popover-content-available-width))`
                }}
                side={showPopoverBelow ? "bottom" : "top"}
                align="center"
                sideOffset={10}
                collisionPadding={12}
                collisionBoundary={canvasBoundary}
                avoidCollisions
                sticky="always"
                onInteractOutside={event => {
                  event.preventDefault();
                }}
              >
                {displayPopoverContent(selectedTile)}
                <Popover.Close
                  className={styles["tile-popover-close"]}
                  aria-label="Close"
                  onClick={() => {
                    clearSelection();
                  }}
                >
                  <Cross2Icon />
                </Popover.Close>
                <Popover.Arrow className={styles["tile-popover-arrow"]} />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
        <Dialog.Portal>
          <Dialog.Overlay className={styles["manage-dialog-overlay"]} />
          <Dialog.Content className={styles["manage-dialog-content"]}>
            <Dialog.Title>Manage estate</Dialog.Title>
            <Dialog.Description>
              Review your resources and plan improvements to the farm.
            </Dialog.Description>
            <Tabs.Root defaultValue="build" className={styles["manage-tabs"]}>
              <Tabs.List
                className={styles["manage-tabs-list"]}
                aria-label="Estate management sections"
              >
                <Tabs.Trigger
                  className={styles["manage-tabs-trigger"]}
                  value="build"
                >
                  Build
                </Tabs.Trigger>
                <Tabs.Trigger
                  className={styles["manage-tabs-trigger"]}
                  value="resources"
                >
                  Resources
                </Tabs.Trigger>
                <Tabs.Trigger
                  className={styles["manage-tabs-trigger"]}
                  value="farmer"
                >
                  Farmer
                </Tabs.Trigger>
              </Tabs.List>

              <Tabs.Content
                className={styles["manage-tabs-content"]}
                value="build"
              >
                <h2>Available buildings</h2>
                <p>
                  Place buildings beside a road. Each building needs its own
                  free road tile for loading goods.
                </p>
                <p>
                  To extend the main road, click an adjacent empty ground or
                  arable tile and choose Build road. Dirt roads are free.
                </p>
                <ul className={styles["building-list"]}>
                  <li>
                    <h3 className={styles["building-title"]}>
                      <img
                        src={granaryImage}
                        alt=""
                        width={48}
                        height={48}
                        draggable={false}
                      />
                      {granaryCount > 0 ? "Second granary" : "Granary"}
                    </h3>
                    <p>
                      2×2 · 2 minutes · {availableReed}/
                      {FARM_BUILDING_DEFINITIONS.granary.materials.reed} reed ·{" "}
                      {availableClay}/
                      {FARM_BUILDING_DEFINITIONS.granary.materials.clay} clay
                    </p>
                    <p>
                      Store and protect up to{" "}
                      {granaryCapacityForLevel(farmLevel)} additional barley.
                    </p>
                    <button
                      disabled={!canBuildGranary}
                      onClick={() => {
                        clearSelection();
                        buildingPlacementStore
                          .getState()
                          .startPlacement("granary");
                        setIsOpenManageDialog(false);
                      }}
                    >
                      {canBuildGranary
                        ? "Build granary"
                        : `Unlock at level ${granaryCount > 0 ? 8 : 2}`}
                    </button>
                  </li>
                  <li>
                    <h3 className={styles["building-title"]}>
                      <img
                        src={millImage}
                        alt=""
                        width={48}
                        height={48}
                        draggable={false}
                      />
                      Mill
                    </h3>
                    <p>
                      2×2 ·{" "}
                      {FARM_BUILDING_DEFINITIONS.mill.constructionDurationMs /
                        60000}{" "}
                      minutes · {availableReed}/
                      {FARM_BUILDING_DEFINITIONS.mill.materials.reed} reed ·{" "}
                      {availableClay}/
                      {FARM_BUILDING_DEFINITIONS.mill.materials.clay} clay
                    </p>
                    <p>
                      Produce Flour or Brewer's Groats. The farmer is occupied
                      during milling.
                    </p>
                    {farmLevel >= 5 && !hasMill && !canBuildMill && (
                      <p>
                        {farmState.type === "ready" &&
                        farmerProductionJob(farmState.snapshot.farm)
                          ? "Wait for the farmer to finish milling or baking before building."
                          : carriedItem !== null
                            ? "Empty the farmer's hands before building."
                            : "The Mill is unlocked. Collect 2 reed and 4 clay to build it."}
                      </p>
                    )}
                    <button
                      disabled={!canBuildMill}
                      onClick={() => {
                        clearSelection();
                        buildingPlacementStore
                          .getState()
                          .startPlacement("mill");
                        setIsOpenManageDialog(false);
                      }}
                    >
                      {hasMill
                        ? "Already built"
                        : farmLevel < 5
                        ? "Unlock at level 5"
                        : availableReed <
                              FARM_BUILDING_DEFINITIONS.mill.materials.reed ||
                            availableClay <
                              FARM_BUILDING_DEFINITIONS.mill.materials.clay
                          ? "Gather materials"
                          : "Build Mill"}
                    </button>
                  </li>
                  <li>
                    <h3 className={styles["building-title"]}>
                      <img
                        src={breweryImage}
                        alt=""
                        width={48}
                        height={48}
                        draggable={false}
                      />
                      Brewery
                    </h3>
                    <p>
                      2×2 ·{" "}
                      {FARM_BUILDING_DEFINITIONS.brewery
                        .constructionDurationMs / 60000}{" "}
                      minutes · {availableReed}/
                      {FARM_BUILDING_DEFINITIONS.brewery.materials.reed} reed ·{" "}
                      {availableClay}/
                      {FARM_BUILDING_DEFINITIONS.brewery.materials.clay} clay ·{" "}
                      {availableVessels}/
                      {
                        FARM_BUILDING_DEFINITIONS.brewery.materials
                          .brewingVessels
                      }{" "}
                      brewing jars
                    </p>
                    <p>
                      Brew beer to trade or give the farmer as a happiness
                      treat. Buy brewing jars at the NPC market for{" "}
                      {
                        MARKET_ITEM_DEFINITIONS.brewingVessels.npcMarket
                          .buyPrice
                      }{" "}
                      shekels each. Materials are consumed when construction
                      starts.
                    </p>
                    <button
                      disabled={!canBuildBrewery}
                      onClick={() => {
                        clearSelection();
                        buildingPlacementStore
                          .getState()
                          .startPlacement("brewery");
                        setIsOpenManageDialog(false);
                      }}
                    >
                      {hasBrewery
                        ? "Already built"
                        : farmLevel < 6 ? "Unlock at level 6" : "Build brewery"}
                    </button>
                  </li>
                  <li>
                    <h3 className={styles["building-title"]}>
                      <img
                        src={breadOvenImage}
                        alt=""
                        width={48}
                        height={48}
                        draggable={false}
                      />
                      Bread Oven
                    </h3>
                    <p>
                      {BREAD_OVEN_DEFINITION.footprint.columns}×
                      {BREAD_OVEN_DEFINITION.footprint.rows} ·{" "}
                      {BREAD_OVEN_DEFINITION.constructionDurationMs / 60000}{" "}
                      minutes · {availableReed}/
                      {BREAD_OVEN_DEFINITION.materials.reed} reed ·{" "}
                      {availableClay}/{BREAD_OVEN_DEFINITION.materials.clay}{" "}
                      clay · {availableBakingTools}/
                      {BREAD_OVEN_DEFINITION.materials.bakingTools} baking tools
                    </p>
                    <p>
                      Turn Flour into bread. Collect finished baskets and
                      deliver them to the farm. Buy baking tools at the NPC
                      Baking market for{" "}
                      {MARKET_ITEM_DEFINITIONS.bakingTools.npcMarket.buyPrice}{" "}
                      shekels each.
                    </p>
                    <button
                      disabled={
                        !canBuildBreadOven ||
                        !!(
                          farmState.type === "ready" &&
                          farmState.snapshot.farm.production.delivery
                        )
                      }
                      onClick={() => {
                        clearSelection();
                        buildingPlacementStore
                          .getState()
                          .startPlacement("breadOven");
                        setIsOpenManageDialog(false);
                      }}
                    >
                      {hasBreadOven
                        ? "Already built"
                        : farmLevel < 6 ? "Unlock at level 6" : "Build Bread Oven"}
                    </button>
                  </li>
                </ul>
              </Tabs.Content>

              <Tabs.Content
                className={styles["manage-tabs-content"]}
                value="resources"
              >
                <h2>Resources</h2>
                {farmState.type === "ready" ? (
                  <div className={styles["resource-sections"]}>
                    <section>
                      <h3 className={styles["resource-title"]}>
                        <img
                          src={flourBagsImage}
                          alt=""
                          width={32}
                          height={32}
                          draggable={false}
                        />
                        Processed grain
                      </h3>
                      <dl className={styles["resource-list"]}>
                        <div>
                          <dt>Flour</dt>
                          <dd>
                            {farmState.snapshot.inventory.find(
                              i => i.itemKey === "flour"
                            )?.quantity ?? 0}
                          </dd>
                        </div>
                        <div>
                          <dt>Brewer's Groats</dt>
                          <dd>
                            {farmState.snapshot.inventory.find(
                              i => i.itemKey === "brewersGroats"
                            )?.quantity ?? 0}
                          </dd>
                        </div>
                      </dl>
                    </section>
                    <section>
                      <dl className={styles["resource-list"]}>
                        <div>
                          <dt className={styles["resource-title"]}>
                            <img
                              src={shekelsImage}
                              alt=""
                              width={32}
                              height={32}
                              draggable={false}
                            />
                            Shekels
                          </dt>
                          <dd>{farmState.snapshot.player.shekelBalance}</dd>
                        </div>
                      </dl>
                    </section>

                    <section>
                      <h3 className={styles["resource-title"]}>
                        <img
                          src={barleyImage}
                          alt=""
                          width={32}
                          height={32}
                          draggable={false}
                        />
                        Barley
                      </h3>
                      <dl className={styles["resource-list"]}>
                        <div className={styles["resource-total"]}>
                          <dt>Total</dt>
                          <dd>{totalBarley}</dd>
                        </div>
                        <div>
                          <dt>Farm storage</dt>
                          <dd>{storedBarley}</dd>
                        </div>
                        <div>
                          <dt>Granary storage</dt>
                          <dd>{granaryBarley}</dd>
                        </div>
                        <div>
                          <dt>Other</dt>
                          <dd>{carriedBarley + exposedBarley}</dd>
                        </div>
                        <div>
                          <dt>Reserved for brewing</dt>
                          <dd>{breweryBarley}</dd>
                        </div>
                      </dl>
                    </section>

                    <section>
                      <h3>Food and drink</h3>
                      <dl className={styles["resource-list"]}>
                        {([
                          { key: "bread", label: "Bread", image: breadBasketImage },
                          { key: "beer", label: "Filled beer jars", image: beerJarsImage },
                          { key: "fish", label: "Fish", image: fishImage }
                        ] as const).map(item => <div key={item.key}>
                          <dt className={styles["resource-title"]}>
                            <img src={item.image} alt="" width={32} height={32} draggable={false} />
                            {item.label}
                          </dt>
                          <dd>{farmState.snapshot.inventory.find(entry => entry.itemKey === item.key)?.quantity ?? 0}
                            {item.key === "fish" && ` / ${FISH_CAPACITY}`}
                          </dd>
                        </div>)}
                      </dl>
                    </section>
                    <section>
                      <h3>Equipment</h3>
                      <dl className={styles["resource-list"]}>
                        <div><dt>Brewing jars</dt><dd>{availableVessels}</dd></div>
                        <div><dt>Empty beer jars</dt><dd>{availableEmptyBeerJars}</dd></div>
                        <div><dt>Baking tools</dt><dd>{availableBakingTools}</dd></div>
                      </dl>
                    </section>
                    <section>
                      <h3>Animals</h3>
                      <dl className={styles["resource-list"]}>
                        <div>
                          <dt className={styles["resource-title"]}>
                            <img src={FARM_SPRITES.donkey} alt="" width={32} height={32} draggable={false} />
                            Mill donkey
                          </dt>
                          <dd>{farmState.snapshot.inventory.find(item => item.itemKey === "donkey")?.quantity ?? 0}</dd>
                        </div>
                      </dl>
                    </section>
                    <section>
                      <h3>Building materials</h3>
                      <dl className={styles["resource-list"]}>
                        <div>
                          <dt className={styles["resource-title"]}>
                            <img
                              src={reedImage}
                              alt=""
                              width={32}
                              height={32}
                              draggable={false}
                            />
                            Reed
                          </dt>
                          <dd>{totalReed}</dd>
                        </div>
                        <div>
                          <dt className={styles["resource-title"]}>
                            <img
                              src={clayImage}
                              alt=""
                              width={32}
                              height={32}
                              draggable={false}
                            />
                            Clay bricks
                          </dt>
                          <dd>{totalClay}</dd>
                        </div>
                      </dl>
                    </section>
                  </div>
                ) : (
                  <p>Farm resources are loading…</p>
                )}
              </Tabs.Content>
              <Tabs.Content
                className={styles["manage-tabs-content"]}
                value="farmer"
              >
                {farmState.type === "ready" ? (
                  <FarmerPanel
                    snapshot={farmState.snapshot}
                    now={storageClock}
                  />
                ) : (
                  <p>Farmer information is loading…</p>
                )}
              </Tabs.Content>
            </Tabs.Root>
            <Dialog.Close asChild>
              <button
                className={styles["manage-dialog-close"]}
                aria-label="Close estate management"
              >
                <Cross2Icon />
              </button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root
        open={isOpenMarketDialog}
        onOpenChange={open => {
          setMarketDialogOpen(open);

          if (!open) {
            setMarketTradeError(null);
            setMarketQuoteState({ type: "idle" });
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className={styles["market-dialog-overlay"]} />
          <Dialog.Content className={styles["market-dialog-content"]}>
            <header className={styles["market-dialog-header"]}>
              <Dialog.Title>
                {MARKET_TITLES[marketScope]}
                {marketScope === "barley" ? (
                  <span className="cuneiforms">𒆠𒇴𒊺𒀀</span>
                ) : marketScope === "beer" ? (
                  <span className="cuneiforms">𒆠𒇴𒁉𒀀</span>
                ) : marketScope === "bread" ? (
                  <span className="cuneiforms">𒆠𒇴𒃻𒀀</span>
                ) : null}
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  className={styles["market-dialog-close"]}
                  aria-label="Close market"
                >
                  <Cross2Icon />
                </button>
              </Dialog.Close>
            </header>
            <div className={styles["market-dialog-body"]}>
              <Dialog.Description>
                Trade {marketScope} with the NPC market or buy listings from
                other players.
              </Dialog.Description>
              {farmLevel < (marketScope === "barley" ? 3 : 6) && (
                <p role="note">
                  This market unlocks at level{" "}
                  {marketScope === "barley" ? 3 : 6}.
                </p>
              )}
              {farmState.type === "ready" &&
              marketQuoteState.type === "ready" ? (
                <div className={styles["market-trade"]}>
                  <dl className={styles["market-balances"]}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center"
                      }}
                    >
                      <dt>
                        Shekels <span className="cuneiforms small">𒂆</span>
                      </dt>
                      <dd>{farmState.snapshot.player.shekelBalance}</dd>
                    </div>
                    <div>
                      <dt>
                        {marketScope === "beer"
                          ? "Filled beer jars"
                          : marketScope === "bread"
                            ? "Stored bread"
                            : "Stored barley"}
                      </dt>
                      <dd>
                        {marketScope !== "barley"
                          ? (farmState.snapshot.inventory.find(
                              item => item.itemKey === marketScope
                            )?.quantity ?? 0)
                          : `${storedHouseholdBarley} / ${householdBarleyCapacity}`}
                      </dd>
                    </div>
                  </dl>

                  <Tabs.Root
                    key={marketScope}
                    defaultValue="npc"
                    className={styles["manage-tabs"]}
                  >
                    <Tabs.List
                      className={styles["manage-tabs-list"]}
                      aria-label="Market type"
                    >
                      <Tabs.Trigger
                        className={styles["manage-tabs-trigger"]}
                        value="npc"
                      >
                        NPC market
                      </Tabs.Trigger>
                      <Tabs.Trigger
                        className={styles["manage-tabs-trigger"]}
                        value="player"
                      >
                        Player market
                      </Tabs.Trigger>
                    </Tabs.List>
                    {(["npc", "player"] as const).map(market => (
                      <Tabs.Content
                        key={market}
                        value={market}
                        className={styles["market-tab-content"]}
                      >
                        <p>
                          {market === "npc"
                            ? "Buy and sell at fixed prices with NPC merchants."
                            : "Buy goods from other players or sell your own stored goods."}
                        </p>
                        <Tabs.Root
                          defaultValue="buy"
                          className={styles["manage-tabs"]}
                        >
                          <Tabs.List
                            className={styles["manage-tabs-list"]}
                            aria-label={
                              market === "npc"
                                ? "NPC market action"
                                : "Player market action"
                            }
                          >
                            <Tabs.Trigger
                              className={styles["manage-tabs-trigger"]}
                              value="buy"
                            >
                              Buy
                            </Tabs.Trigger>
                            <Tabs.Trigger
                              className={styles["manage-tabs-trigger"]}
                              value="sell"
                            >
                              Sell
                            </Tabs.Trigger>
                          </Tabs.List>
                          {(["buy", "sell"] as const).map(action => (
                            <Tabs.Content
                              key={action}
                              value={action}
                              className={styles["market-tab-content"]}
                            >
                              <p>
                                {market === "npc"
                                  ? action === "buy"
                                    ? "Choose a quantity to buy from NPC merchants."
                                    : "Choose a quantity of stored goods to sell to NPC merchants."
                                  : action === "buy"
                                    ? "Choose a quantity and buy from another player's listing. Your own listings are shown under Sell."
                                    : "Choose a quantity and asking price to create a listing. Manage your unsold listings below."}
                              </p>
                              {marketQuoteState.quotes.items
                                .filter(
                                  item =>
                                    farmLevel >= marketUnlockLevel(item.itemKey)
                                )
                                .filter(item =>
                                  marketIncludesItem(
                                    marketScope,
                                    item.itemKey,
                                    { market, action }
                                  )
                                )
                                .filter(
                                  item =>
                                    action !== "buy" ||
                                    item.itemKey !== "brewingVessels" ||
                                    missingBrewingJars > 0
                                )
                                .filter(item =>
                                  market === "npc"
                                    ? action === "buy"
                                      ? item.npcMarket.canBuy
                                      : item.npcMarket.canSell
                                    : item.playerMarket.canCreateSellOrder
                                )
                                .map(item => {
                                  const quantityKey = `${market}:${action}:${item.itemKey}`;
                                  const quantityLimit = item.itemKey === "donkey" ? 1 :
                                    action === "buy" &&
                                    item.itemKey === "brewingVessels"
                                      ? missingBrewingJars
                                      : undefined;
                                  const marketQuantity = item.itemKey === "donkey" ? 1 : Math.min(
                                    marketQuantities[quantityKey] ?? 1,
                                    quantityLimit ?? Infinity
                                  );
                                  const storedQuantity = match(item.itemKey)
                                    .with("barley", () => storedHouseholdBarley)
                                    .with(
                                      "bakingTools",
                                      () => availableBakingTools
                                    )
                                    .with(
                                      "beer",
                                      "bread",
                                      "flour",
                                      "brewersGroats",
                                      "donkey",
                                      () =>
                                        farmState.snapshot.inventory.find(
                                          entry =>
                                            entry.itemKey === item.itemKey
                                        )?.quantity ?? 0
                                    )
                                    .with(
                                      "brewingVessels",
                                      () => availableVessels
                                    )
                                    .with(
                                      "emptyBeerJar",
                                      () => availableEmptyBeerJars
                                    )
                                    .exhaustive();
                                  const availableStorage = match(
                                    item.storageType
                                  )
                                    .with(
                                      "barley_storage",
                                      () => availableBarleyStorage
                                    )
                                    .with(
                                      "estate_inventory",
                                      () => (item.itemKey === "donkey" ? 1 : 2147483647) - storedQuantity
                                    )
                                    .exhaustive();
                                  const purchaseCost =
                                    marketQuantity * item.npcMarket.buyPrice;
                                  const saleValue =
                                    marketQuantity * item.npcMarket.sellPrice;
                                  const listingPrice =
                                    marketSellPrices[item.itemKey] ??
                                    item.playerMarket.suggestedSellPrice;
                                  const cuneiformLabel = () => {
                                    switch (item.itemKey) {
                                      case "barley":
                                        return "𒊺";
                                      case "brewingVessels":
                                        return "𒂁";
                                      case "emptyBeerJar":
                                        return "𒂁𒋤𒂵";
                                      case "brewersGroats":
                                        return "𒃻𒄯𒊏";
                                      case "bread":
                                        return "𒃻";
                                      case "flour":
                                        return "𒍥";
                                      default:
                                        return "";
                                    }
                                  };

                                  return (
                                    <section
                                      className={styles["market-item"]}
                                      key={item.itemKey}
                                    >
                                      <h3>
                                        {item.itemKey === "donkey" && <img src={FARM_SPRITES.donkey} alt="" width={48} height={48} />}
                                        {item.itemKey === "beer" && (
                                          <img
                                            src={beerJarsImage}
                                            alt=""
                                            width={48}
                                            height={48}
                                          />
                                        )}
                                        {item.itemKey === "bakingTools" && (
                                          <img
                                            src={bakingToolsImage}
                                            alt=""
                                            width={48}
                                            height={48}
                                          />
                                        )}
                                        {item.itemKey === "bread" && (
                                          <img
                                            src={breadBasketImage}
                                            alt=""
                                            width={48}
                                            height={48}
                                          />
                                        )}
                                        {item.itemKey === "flour" && (
                                          <img
                                            src={flourBagsImage}
                                            alt=""
                                            width={48}
                                            height={48}
                                          />
                                        )}
                                        {item.label}
                                        <span
                                          className="cuneiforms small"
                                          style={{ marginLeft: "0.5rem" }}
                                        >
                                          {cuneiformLabel()}
                                        </span>
                                      </h3>
                                      {item.itemKey === "beer" && (
                                        <p>
                                          Owned: {storedQuantity} filled jars in
                                          estate inventory. <br />
                                          Each sale includes the jar; no empty
                                          jar is returned.
                                        </p>
                                      )}
                                      {market === "npc" && (
                                        <p>
                                          {action === "buy"
                                            ? "Buy for "
                                            : "Sell for "}
                                          {formatShekels(
                                            action === "buy"
                                              ? item.npcMarket.buyPrice
                                              : item.npcMarket.sellPrice
                                          )}{" "}
                                          each
                                          {item.storageType ===
                                            "estate_inventory" && (
                                            <>
                                              {" "}
                                              · Owned: {storedQuantity}. <br />
                                              {item.itemKey === "donkey" ? "One donkey per farm. Processes 6 barley into 3 Flour or Brewer's Groats in 15 minutes, leaving the farmer free." : "Kept in estate inventory; does not use barley storage."}
                                            </>
                                          )}
                                        </p>
                                      )}
                                      {item.itemKey !== "donkey" && <label
                                        className={styles["market-quantity"]}
                                      >
                                        {action === "buy"
                                          ? "Quantity to buy"
                                          : action === "sell"
                                            ? "Quantity to sell"
                                            : "Quantity"}
                                        <input
                                          type="number"
                                          min="1"
                                          max={quantityLimit}
                                          step="1"
                                          value={marketQuantity}
                                          disabled={marketTradePending}
                                          onChange={event => {
                                            const quantity = Number.parseInt(
                                              event.currentTarget.value,
                                              10
                                            );
                                            setMarketQuantities(current => ({
                                              ...current,
                                              [quantityKey]: Number.isNaN(
                                                quantity
                                              )
                                                ? 1
                                                : Math.min(
                                                    quantityLimit ?? Infinity,
                                                    Math.max(1, quantity)
                                                  )
                                            }));
                                          }}
                                        />
                                      </label>}
                                      {market === "npc" && (
                                        <div
                                          className={styles["market-actions"]}
                                        >
                                          {action === "buy" && (
                                            <button
                                              disabled={
                                                marketTradePending ||
                                                !item.npcMarket.canBuy ||
                                                farmState.snapshot.player
                                                  .shekelBalance <
                                                  purchaseCost ||
                                                availableStorage <
                                                  marketQuantity
                                              }
                                              onClick={() => {
                                                void tradeMarketItem(
                                                  "buy",
                                                  item.itemKey,
                                                  item.npcMarket.buyPrice,
                                                  marketQuantity
                                                );
                                              }}
                                            >
                                              {!item.npcMarket.canBuy
                                                ? "Buying unavailable"
                                                : availableStorage <
                                                    marketQuantity
                                                  ? item.itemKey === "donkey" ? "Already owned" : "Not enough storage"
                                                  : farmState.snapshot.player
                                                        .shekelBalance <
                                                      purchaseCost
                                                    ? "Not enough shekels"
                                                    : `Buy for ${formatShekels(purchaseCost)}`}
                                            </button>
                                          )}
                                          {action === "sell" && (
                                            <button
                                              disabled={
                                                marketTradePending ||
                                                !item.npcMarket.canSell ||
                                                storedQuantity < marketQuantity
                                              }
                                              onClick={() => {
                                                void tradeMarketItem(
                                                  "sell",
                                                  item.itemKey,
                                                  item.npcMarket.sellPrice,
                                                  marketQuantity
                                                );
                                              }}
                                            >
                                              {!item.npcMarket.canSell
                                                ? "Selling unavailable"
                                                : storedQuantity <
                                                    marketQuantity
                                                  ? `Not enough stored ${item.label.toLowerCase()}`
                                                  : `Sell for ${formatShekels(saleValue)}`}
                                            </button>
                                          )}
                                        </div>
                                      )}
                                      {market === "player" && (
                                        <>
                                          <dl
                                            className={
                                              styles["market-statistics"]
                                            }
                                          >
                                            <div>
                                              <dt>Lowest asking price</dt>
                                              <dd>
                                                {item.playerMarket
                                                  .lowestSellPrice === null
                                                  ? "No listings"
                                                  : formatShekels(
                                                      item.playerMarket
                                                        .lowestSellPrice
                                                    )}
                                              </dd>
                                            </div>
                                            <div>
                                              <dt>Average asking price</dt>
                                              <dd>
                                                {item.playerMarket
                                                  .weightedAverageSellPrice ===
                                                null
                                                  ? "No listings"
                                                  : formatShekels(
                                                      Number(
                                                        item.playerMarket.weightedAverageSellPrice.toFixed(
                                                          1
                                                        )
                                                      )
                                                    )}
                                              </dd>
                                            </div>
                                            <div>
                                              <dt>Quantity for sale</dt>
                                              <dd>
                                                {
                                                  item.playerMarket
                                                    .totalSellQuantity
                                                }
                                              </dd>
                                            </div>
                                            <div>
                                              <dt>
                                                Average traded price (24h)
                                              </dt>
                                              <dd>
                                                {item.playerMarket
                                                  .recentTradeAveragePrice ===
                                                null
                                                  ? "No trades in the last 24h"
                                                  : formatShekels(
                                                      Number(
                                                        item.playerMarket.recentTradeAveragePrice.toFixed(
                                                          1
                                                        )
                                                      )
                                                    )}
                                              </dd>
                                            </div>
                                          </dl>
                                          {action === "sell" && (
                                            <div
                                              className={
                                                styles[
                                                  "market-listing-controls"
                                                ]
                                              }
                                            >
                                              <label
                                                className={
                                                  styles["market-quantity"]
                                                }
                                              >
                                                Asking price per item
                                                <input
                                                  type="number"
                                                  min="1"
                                                  step="1"
                                                  value={listingPrice}
                                                  disabled={marketTradePending}
                                                  onChange={event => {
                                                    const price =
                                                      Number.parseInt(
                                                        event.currentTarget
                                                          .value,
                                                        10
                                                      );
                                                    setMarketSellPrices(
                                                      prices => ({
                                                        ...prices,
                                                        [item.itemKey]:
                                                          Number.isNaN(price)
                                                            ? 1
                                                            : Math.max(1, price)
                                                      })
                                                    );
                                                  }}
                                                />
                                              </label>
                                              <span>
                                                Suggested:{" "}
                                                {formatShekels(
                                                  item.playerMarket
                                                    .suggestedSellPrice
                                                )}
                                              </span>
                                              <button
                                                disabled={
                                                  marketTradePending ||
                                                  !item.playerMarket
                                                    .canCreateSellOrder ||
                                                  storedQuantity <
                                                    marketQuantity
                                                }
                                                onClick={() => {
                                                  void createMarketSellOrder(
                                                    item.itemKey,
                                                    listingPrice,
                                                    marketQuantity
                                                  );
                                                }}
                                              >
                                                {!item.playerMarket
                                                  .canCreateSellOrder
                                                  ? "Player listings unavailable"
                                                  : storedQuantity <
                                                      marketQuantity
                                                    ? `Not enough stored ${item.label.toLowerCase()}`
                                                    : `Create sell listing: ${marketQuantity} for ${formatShekels(
                                                        listingPrice
                                                      )} each`}
                                              </button>
                                            </div>
                                          )}
                                          <MarketListings
                                            key={`${action}:${item.itemKey}`}
                                            itemKey={item.itemKey}
                                            action={
                                              action === "sell" ? "sell" : "buy"
                                            }
                                            quantity={marketQuantity}
                                            availableStorage={availableStorage}
                                            balance={
                                              farmState.snapshot.player
                                                .shekelBalance
                                            }
                                            pending={marketTradePending}
                                            farmVersion={
                                              farmState.snapshot.farm.version
                                            }
                                            buy={(orderId, unitPrice) =>
                                              buyPlayerListing(
                                                orderId,
                                                unitPrice,
                                                marketQuantity
                                              )
                                            }
                                            cancel={cancelMarketSellOrder}
                                          />
                                        </>
                                      )}
                                    </section>
                                  );
                                })}
                            </Tabs.Content>
                          ))}
                        </Tabs.Root>
                      </Tabs.Content>
                    ))}
                  </Tabs.Root>
                  {marketTradeError !== null && (
                    <p className={styles["market-error"]} role="alert">
                      {marketTradeError}
                    </p>
                  )}
                </div>
              ) : marketQuoteState.type === "failed" ? (
                <div>
                  <p role="alert">{marketQuoteState.reason}</p>
                  <button
                    onClick={() => {
                      setMarketQuoteState({ type: "loading" });
                      setMarketQuoteRefresh(refresh => refresh + 1);
                    }}
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <p>
                  {farmState.type === "ready"
                    ? "Loading market prices…"
                    : "Farm resources are loading…"}
                </p>
              )}
              {isOpenMarketDialog && (
                <MarketTradeHistory
                  key={marketScope}
                  refresh={marketQuoteRefresh}
                  scope={marketScope}
                />
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
