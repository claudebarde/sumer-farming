import { useEffect, useState } from "react";
import { Dialog, Popover, Tabs } from "radix-ui";
import { Cross2Icon, ExternalLinkIcon } from "@radix-ui/react-icons";
import { match } from "ts-pattern";
import styles from "../styles/GameCanvas.module.scss";
import { GAME_CONTAINER_ID, TILE_SIZE } from "../game/phaser/config";
import { createGame } from "../game/phaser/game";
import { MainScene } from "../game/phaser/scenes/MainScene";
import { useStore } from "zustand";
import { gridStore } from "../stores/gridStore";
import { interactionStore } from "../stores/interactionStore";
import { BEER_TREAT_INTERVAL_MS } from "../../game-data/household";
import { getFarmerMood, validateBeerTreat, beerTreatErrors } from "../../game-core/farm/wellbeing";
import { getBrewingState, validateBrewing, brewingErrors, readyBeerQuantity } from "../../game-core/farm/brewing";
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
import { fetchDevelopmentFarm } from "../api/developmentPlayer";
import type { MarketQuotes } from "../../schemas/market";
import {
  MARKET_ITEM_DEFINITIONS,
  type MarketItemKey
} from "../../game-data/marketItems";
import { farmStore } from "../stores/farmStore";
import { buildingPlacementStore } from "../stores/buildingPlacementStore";
import { marketUiStore } from "../stores/marketUiStore";
import {
  calculateFarmStorageCapacity,
  FARMER_CARRY_CAPACITY,
  FARM_STORAGE_CAPACITY
} from "../../game-data/storage";
import { FARM_BUILDING_DEFINITIONS } from "../../game-data/buildings";
import { INITIAL_FARM_CONFIG } from "../../game-data/initialFarm";

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
  const [beerGiftPending, setBeerGiftPending] = useState(false);
  const [beerGiftMessage, setBeerGiftMessage] = useState<string | null>(null);
  const [storageClock, setStorageClock] = useState(() => Date.now());
  const [marketQuantity, setMarketQuantity] = useState(1);
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
  const beerAvailableAt = farmState.type === "ready" && farmState.snapshot.farm.household.lastBeerAt !== null
    ? Date.parse(farmState.snapshot.farm.household.lastBeerAt) + BEER_TREAT_INTERVAL_MS
    : null;
  const beerOnCooldown = beerAvailableAt !== null && storageClock < beerAvailableAt;
  const isOpenMarketDialog = useStore(marketUiStore, state => state.isOpen);
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
  const canBuildBrewery =
    availableReed >= FARM_BUILDING_DEFINITIONS.brewery.materials.reed &&
    availableClay >= FARM_BUILDING_DEFINITIONS.brewery.materials.clay &&
    availableVessels >=
      FARM_BUILDING_DEFINITIONS.brewery.materials.brewingVessels &&
    carriedItem === null;
  const canBuildGranary =
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
      ? calculateFarmStorageCapacity(farmState.snapshot.buildings, storageClock)
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
    selectedTile?.type === "brewery"
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
    expectedUnitPrice: number
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
        quantity: marketQuantity,
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
    unitPrice: number
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
        quantity: marketQuantity,
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
    expectedUnitPrice: number
  ): Promise<void> => {
    if (farmState.type !== "ready" || marketTradePending) return;
    setMarketTradePending(true);
    setMarketTradeError(null);
    try {
      const snapshot = await executeGameCommand({
        type: "buy_market_sell_order",
        orderId,
        expectedUnitPrice,
        quantity: marketQuantity,
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

  const isNextToRiver = (tile: Tile): boolean =>
    Object.values(gridStore.getState().findAdjacentTiles(tile.position)).some(
      adjacentTile => adjacentTile?.type === "water"
    );

  const isNextToIrrigationCanal = (tile: Tile): boolean =>
    Object.values(gridStore.getState().findAdjacentTiles(tile.position)).some(
      adjacentTile => adjacentTile?.type.startsWith("canal") === true
    );

  const buildIrrigationButton = (tile: Tile) => (
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

  const displayPopoverContent = (tile: typeof selectedTile) => {
    if (!tile) return <span>No tile selected</span>;

    if (carriedItem?.itemKey === "water" && tile.type !== "brewery") {
      const canPour = [
        "ground",
        "groundVariant",
        "water",
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
      .with("ground", () => {
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
              Fertile soil suitable for farming
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
            {/* the Sell button is just a placeholder for now */}
            <button>Sell</button>
          </div>
        </div>
      ))
      .with("reedBundle", "brickPile", groundItemType => {
        const item = groundItemType === "reedBundle" ? "reed" : "clay";

        return (
          <div className={styles["tile-popover-content"]}>
            <div className={styles["tile-popover-content-header"]}>
              <span>{item === "reed" ? "Reed bundle" : "Clay bricks"}</span>
            </div>
            <div className={styles["tile-popover-content-body"]}>
              Building material left on the arable ground
              <button
                disabled={carriedItem !== null}
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
      .with("barleyGrowing", () => (
        <div className={styles["tile-popover-content"]}>
          <div className={styles["tile-popover-content-header"]}>
            <span className="cuneiforms">𒊺</span>
            <span>Growing barley</span>
          </div>
          <div className={styles["tile-popover-content-body"]}>
            The barley is still growing
          </div>
        </div>
      ))
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
            <button
              disabled={storedBarley === 0 || carriedItem !== null}
              onClick={() =>
                addCommand({
                  type: "withdraw",
                  target: tile.position,
                  item: "barley",
                  storage: "farm"
                })
              }
            >
              {storedBarley === 0
                ? "Farm storage is empty"
                : carriedItem !== null
                  ? "Empty your hands first"
                  : "Take 1 Barley"}
            </button>
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
        const brewing = getBrewingState(brewery?.beerReadyAt ?? null, storageClock);
        const readyBeer = brewery === undefined ? 0 : readyBeerQuantity(brewery, storageClock);
        const household = farmState.type === "ready" ? farmState.snapshot.farm.household : null;
        const lastBeerAt = household?.lastBeerAt ? Date.parse(household.lastBeerAt) : null;
        const beerQuantity = farmState.type === "ready" ? farmState.snapshot.inventory.find(item => item.itemKey === "beer")?.quantity ?? 0 : 0;
        const treatRule = validateBeerTreat(readyBeer + beerQuantity, household?.happiness ?? 100, lastBeerAt, storageClock);
        const brewRule = brewery === undefined ? null : validateBrewing("start_brewing", brewery, storageClock);
        const canDeliver =
          complete &&
          (carriedItem?.itemKey === "water" ||
            carriedItem?.itemKey === "barley");
        const full =
          carriedItem !== null &&
          brewery !== undefined &&
          (carriedItem.itemKey === "water"
            ? brewery.brewingWater + carriedItem.quantity > BREWERY_WATER_CAPACITY
            : carriedItem.itemKey === "barley" &&
              brewery.brewingBarley + carriedItem.quantity > BEER_RECIPE.barley);
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
                  <span>Barley: {brewery.brewingBarley} / {BEER_RECIPE.barley}</span>
                  <span>
                    Empty beer jars: {brewery.emptyBeerJars} /{" "}
                    {BREWERY_EMPTY_JAR_CAPACITY}
                  </span>
                  {match(brewing)
                    .with({ type: "idle" }, () => (
                      <>
                        {brewRule === null ? (
                          <button onClick={() => addCommand({
                            type: "brewery_supply", action: "start_brewing", target: tile.position
                          })}>Start brewing</button>
                        ) : <span>{brewingErrors[brewRule]}</span>}
                      </>
                    ))
                    .with({ type: "brewing" }, ({ readyAt }) => {
                      const seconds = Math.max(0, Math.ceil((readyAt - storageClock) / 1000));
                      return <span>Brewing: {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")} remaining</span>;
                    })
                    .with({ type: "ready" }, () => (
                      <>
                        <span>{readyBeer} beer {readyBeer === 1 ? "jar" : "jars"} ready. Collect to free the brewery.</span>
                        <button onClick={() => addCommand({
                          type: "brewery_supply", action: "collect_beer", target: tile.position
                        })}>Collect {readyBeer} beer {readyBeer === 1 ? "jar" : "jars"} into estate inventory</button>
                      </>
                    ))
                    .exhaustive()}
                  {treatRule === null ? (
                    <button onClick={() => addCommand({
                      type: "brewery_supply", action: "give_beer", target: tile.position
                    })}>Give 1 beer to the farmer (+15 happiness)</button>
                  ) : null}
                  {carriedItem === null &&
                  availableEmptyBeerJars === 0 &&
                  brewery.emptyBeerJars < BREWERY_EMPTY_JAR_CAPACITY ? (
                    <button
                      type="button"
                      onClick={() => {
                        clearSelection();
                        setMarketDialogOpen(true);
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
                  {canDeliver && (
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
                        ? carriedItem.itemKey === "barley"
                          ? "Not enough barley space (maximum 2)"
                          : "Brewery water supply is full"
                        : `Deliver ${carriedItem.itemKey}`}
                    </button>
                  )}
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
            Adds 15 barley storage.
            {selectedGranary !== undefined &&
              Date.parse(selectedGranary.completesAt) <= storageClock && (
                <>
                  <span>
                    Stored barley: {selectedGranary.storedBarley} /{" "}
                    {FARM_BUILDING_DEFINITIONS.granary.barleyStorageBonus}
                  </span>
                  {carriedItem?.itemKey === "barley" && (
                    <button
                      disabled={
                        selectedGranary.storedBarley >=
                        FARM_BUILDING_DEFINITIONS.granary.barleyStorageBonus
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
                      FARM_BUILDING_DEFINITIONS.granary.barleyStorageBonus
                        ? "Granary is full"
                        : "Store Barley"}
                    </button>
                  )}
                  {carriedItem === null && (
                    <button
                      disabled={selectedGranary.storedBarley === 0}
                      onClick={() =>
                        addCommand({
                          type: "withdraw",
                          target: tile.position,
                          item: "barley",
                          storage: "granary"
                        })
                      }
                    >
                      {selectedGranary.storedBarley === 0
                        ? "Granary is empty"
                        : "Take 1 Barley"}
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
                <span>Hunger: {farmState.snapshot.farm.household.hungrySince === null ? "Fed" : "Hungry"}</span>
                <span>
                  Happiness: {farmState.snapshot.farm.household.happiness} / 100 ·{" "}
                  {match(getFarmerMood(farmState.snapshot.farm.household.happiness))
                    .with("happy", () => "Happy")
                    .with("content", () => "Content")
                    .with("unhappy", () => "Unhappy")
                    .exhaustive()}
                </span>
                <meter aria-label="Farmer happiness" min={0} max={100}
                  value={farmState.snapshot.farm.household.happiness} />
                <span>
                  {farmState.snapshot.farm.household.hungrySince !== null
                    ? "I'm hungry and walking slowly. Store barley in the farm or a completed granary so I can eat."
                    : getFarmerMood(farmState.snapshot.farm.household.happiness) === "unhappy"
                      ? "I'm unhappy and walking a little more slowly."
                      : "I'm fed and walking at my normal pace."}
                </span>
                {farmState.snapshot.farm.household.nextBarleyConsumptionAt !== null &&
                  farmState.snapshot.farm.household.hungrySince === null && (
                    <span>Next ration in {formatRemainingTime(farmState.snapshot.farm.household.nextBarleyConsumptionAt, storageClock)}</span>
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
      try {
        const snapshot = await fetchDevelopmentFarm(controller.signal);
        const current = farmStore.getState().farm;
        if (
          !controller.signal.aborted &&
          current.type === "ready" &&
          snapshot.farm.id === current.snapshot.farm.id &&
          snapshot.farm.version > current.snapshot.farm.version
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
      <Dialog.Root
        open={isOpenManageDialog}
        onOpenChange={setIsOpenManageDialog}
      >
        <div className={styles["canvas"]}>
          <div className={styles["buttons-container"]}>
            <Dialog.Trigger asChild>
              <button className="with-shadow" style={{ padding: "8px 16px" }}>
                🏺 Manage
              </button>
            </Dialog.Trigger>
          </div>
          <div id={GAME_CONTAINER_ID} className={styles["game-container"]} />
          <Popover.Root
            key={selectedTile?.id ?? "no-selection"}
            open={isOpenTilePopover}
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
                side={showPopoverBelow ? "bottom" : "top"}
                align="center"
                sideOffset={10}
                collisionPadding={12}
                avoidCollisions={!showPopoverBelow}
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
              </Tabs.List>

              <Tabs.Content
                className={styles["manage-tabs-content"]}
                value="build"
              >
                <h2>Available buildings</h2>
                <p>Select a building to place on the farm.</p>
                <ul className={styles["building-list"]}>
                  <li>
                    <h3>Granary</h3>
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
                        : "Collect the required materials first"}
                    </button>
                    <span>
                      2×2 · 2 minutes · +15 barley storage · {availableReed}/
                      {FARM_BUILDING_DEFINITIONS.granary.materials.reed} reed ·{" "}
                      {availableClay}/
                      {FARM_BUILDING_DEFINITIONS.granary.materials.clay} clay
                    </span>
                  </li>
                  <li>
                    <h3>Brewery</h3>
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
                      {carriedItem !== null
                        ? "Empty your hands first"
                        : canBuildBrewery
                          ? "Build brewery"
                          : "Collect the required materials first"}
                    </button>
                    <span>
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
                    </span>
                    <p>
                      Buy a brewing jar at the NPC market for{" "}
                      {
                        MARKET_ITEM_DEFINITIONS.brewingVessels.npcMarket
                          .buyPrice
                      }{" "}
                      shekels. Materials are consumed when construction starts.
                    </p>
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
                      <dl className={styles["resource-list"]}>
                        <div>
                          <dt>Shekels</dt>
                          <dd>{farmState.snapshot.player.shekelBalance}</dd>
                        </div>
                      </dl>
                    </section>

                    <section>
                      <h3>Barley</h3>
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
                      <h3>Beer</h3>
                      <dl className={styles["resource-list"]}>
                        <div>
                          <dt>Filled beer jars</dt>
                          <dd>{farmState.snapshot.inventory.find(item => item.itemKey === "beer")?.quantity ?? 0}</dd>
                        </div>
                      </dl>
                      {(farmState.snapshot.inventory.find(item => item.itemKey === "beer")?.quantity ?? 0) > 0 && (
                        <button disabled={beerGiftPending || beerOnCooldown} onClick={async () => {
                          if (beerGiftPending) return;
                          setBeerGiftPending(true);
                          setBeerGiftMessage(null);
                          const household = farmState.snapshot.farm.household;
                          const rule = validateBeerTreat(
                            farmState.snapshot.inventory.find(item => item.itemKey === "beer")?.quantity ?? 0,
                            household.happiness, household.lastBeerAt === null ? null : Date.parse(household.lastBeerAt), Date.now()
                          );
                          if (rule !== null) {
                            setBeerGiftMessage(beerTreatErrors[rule]);
                            setBeerGiftPending(false);
                            return;
                          }
                          try {
                            const snapshot = await executeGameCommand({
                              type: "give_farmer_beer", expectedFarmVersion: farmState.snapshot.farm.version
                            });
                            farmStore.getState().setReady(snapshot);
                            setBeerGiftMessage("The farmer enjoyed a beer. Happiness increased!");
                          } catch (error) {
                            setBeerGiftMessage(error instanceof Error ? error.message : "Could not give the farmer a beer.");
                          } finally {
                            setBeerGiftPending(false);
                          }
                        }}>{beerGiftPending ? "Giving beer…" : beerOnCooldown
                          ? `Wait ${formatRemainingTime(new Date(beerAvailableAt!).toISOString(), storageClock)}`
                          : "Give one beer to the farmer"}</button>
                      )}
                      {beerGiftMessage !== null && <p role="status">{beerGiftMessage}</p>}
                    </section>

                    <section>
                      <h3>Equipment</h3>
                      <dl className={styles["resource-list"]}>
                        <div>
                          <dt>Brewing jars</dt>
                          <dd>{availableVessels}</dd>
                        </div>
                        <div>
                          <dt>Empty beer jars</dt>
                          <dd>{availableEmptyBeerJars}</dd>
                        </div>
                      </dl>
                    </section>

                    <section>
                      <h3>Building materials</h3>
                      <dl className={styles["resource-list"]}>
                        <div>
                          <dt>Reed</dt>
                          <dd>{totalReed}</dd>
                        </div>
                        <div>
                          <dt>Clay bricks</dt>
                          <dd>{totalClay}</dd>
                        </div>
                      </dl>
                    </section>
                  </div>
                ) : (
                  <p>Farm resources are loading…</p>
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
            <Dialog.Title>
              Market <span className="cuneiforms">𒆠𒇴</span>
            </Dialog.Title>
            <Dialog.Description>
              Trade stored goods with the NPC market or buy listings from other
              players.
            </Dialog.Description>
            {farmState.type === "ready" && marketQuoteState.type === "ready" ? (
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
                    <dt>Stored barley</dt>
                    <dd>
                      {storedHouseholdBarley} / {householdBarleyCapacity}
                    </dd>
                  </div>
                </dl>

                <Tabs.Root defaultValue="npc" className={styles["manage-tabs"]}>
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
                            aria-label={market === "npc" ? "NPC market action" : "Player market action"}
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
                              .filter(item =>
                                market === "npc"
                                  ? action === "buy" ? item.npcMarket.canBuy : item.npcMarket.canSell
                                  : item.playerMarket.canCreateSellOrder
                              )
                              .map(item => {
                                const storedQuantity = match(item.itemKey)
                                  .with("barley", () => storedHouseholdBarley)
                                  .with("beer", () => farmState.snapshot.inventory.find(entry => entry.itemKey === "beer")?.quantity ?? 0)
                                  .with(
                                    "brewingVessels",
                                    () => availableVessels
                                  )
                                  .with(
                                    "emptyBeerJar",
                                    () => availableEmptyBeerJars
                                  )
                                  .exhaustive();
                                const availableStorage = match(item.storageType)
                                  .with(
                                    "barley_storage",
                                    () => availableBarleyStorage
                                  )
                                  .with(
                                    "estate_inventory",
                                    () => 2147483647 - storedQuantity
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
                                      {item.label}
                                      <span
                                        className="cuneiforms small"
                                        style={{ marginLeft: "0.5rem" }}
                                      >
                                        {cuneiformLabel()}
                                      </span>
                                    </h3>
                                    {item.itemKey === "beer" && (
                                      <p>Owned: {storedQuantity} filled jars in estate inventory. Each sale includes the jar; no empty jar is returned.</p>
                                    )}
                                    {market === "npc" && (
                                      <p>
                                        {action === "buy" ? "Buy for " : "Sell for "}
                                        {formatShekels(action === "buy" ? item.npcMarket.buyPrice : item.npcMarket.sellPrice)} each
                                        {item.storageType ===
                                          "estate_inventory" && (
                                          <>
                                            {" "}
                                            · Owned: {storedQuantity}. Kept in
                                            estate inventory; does not use
                                            barley storage.
                                          </>
                                        )}
                                      </p>
                                    )}
                                    <label
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
                                        step="1"
                                        value={marketQuantity}
                                        disabled={marketTradePending}
                                        onChange={event => {
                                          const quantity = Number.parseInt(
                                            event.currentTarget.value,
                                            10
                                          );
                                          setMarketQuantity(
                                            Number.isNaN(quantity)
                                              ? 1
                                              : Math.max(1, quantity)
                                          );
                                        }}
                                      />
                                    </label>
                                    {market === "npc" && (
                                      <div className={styles["market-actions"]}>
                                        {action === "buy" && <button
                                          disabled={
                                            marketTradePending ||
                                            !item.npcMarket.canBuy ||
                                            farmState.snapshot.player
                                              .shekelBalance < purchaseCost ||
                                            availableStorage < marketQuantity
                                          }
                                          onClick={() => {
                                            void tradeMarketItem(
                                              "buy",
                                              item.itemKey,
                                              item.npcMarket.buyPrice
                                            );
                                          }}
                                        >
                                          {!item.npcMarket.canBuy
                                            ? "Buying unavailable"
                                            : availableStorage < marketQuantity
                                              ? "Not enough storage"
                                              : farmState.snapshot.player
                                                    .shekelBalance <
                                                  purchaseCost
                                                ? "Not enough shekels"
                                                : `Buy for ${formatShekels(purchaseCost)}`}
                                        </button>}
                                        {action === "sell" && <button
                                          disabled={
                                            marketTradePending ||
                                            !item.npcMarket.canSell ||
                                            storedQuantity < marketQuantity
                                          }
                                          onClick={() => {
                                            void tradeMarketItem(
                                              "sell",
                                              item.itemKey,
                                              item.npcMarket.sellPrice
                                            );
                                          }}
                                        >
                                          {!item.npcMarket.canSell
                                            ? "Selling unavailable"
                                            : storedQuantity < marketQuantity
                                              ? `Not enough stored ${item.label.toLowerCase()}`
                                              : `Sell for ${formatShekels(saleValue)}`}
                                        </button>}
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
                                            <dt>Average traded price (24h)</dt>
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
                                              styles["market-listing-controls"]
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
                                                  const price = Number.parseInt(
                                                    event.currentTarget.value,
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
                                                storedQuantity < marketQuantity
                                              }
                                              onClick={() => {
                                                void createMarketSellOrder(
                                                  item.itemKey,
                                                  listingPrice
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
                                          buy={buyPlayerListing}
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
              <MarketTradeHistory refresh={marketQuoteRefresh} />
            )}
            <Dialog.Close asChild>
              <button
                className={styles["market-dialog-close"]}
                aria-label="Close market"
              >
                <Cross2Icon />
              </button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
