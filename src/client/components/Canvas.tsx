import { useEffect, useState } from "react";
import { Dialog, Popover, Tabs } from "radix-ui";
import { Cross2Icon } from "@radix-ui/react-icons";
import { match } from "ts-pattern";
import styles from "../styles/GameCanvas.module.scss";
import { GAME_CONTAINER_ID, TILE_SIZE } from "../game/phaser/config";
import { createGame } from "../game/phaser/game";
import { MainScene } from "../game/phaser/scenes/MainScene";
import { useStore } from "zustand";
import { gridStore } from "../stores/gridStore";
import { interactionStore } from "../stores/interactionStore";
import {
  farmerCommandStore,
  type FarmerCommandInput
} from "../stores/farmerCommandStore";
import type { Tile } from "../game/phaser/types";
import { FarmSnapshotSchema } from "../../schemas/farm";
import { executeGameCommand } from "../api/gameActions";
import { fetchMarketQuotes } from "../api/marketQuotes";
import type { MarketQuotes } from "../../schemas/market";
import type { MarketItemKey } from "../../game-data/marketItems";
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

const fetchDevelopmentFarm = async () => {
  const response = await fetch("/api/development/farm", { method: "POST" });

  if (!response.ok) {
    throw new Error("The development farm could not be loaded");
  }

  return FarmSnapshotSchema.parse(await response.json());
};

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
  const [storageClock, setStorageClock] = useState(() => Date.now());
  const [marketQuantity, setMarketQuantity] = useState(1);
  const [marketTradePending, setMarketTradePending] = useState(false);
  const [marketTradeError, setMarketTradeError] = useState<string | null>(null);
  const [marketQuoteState, setMarketQuoteState] = useState<MarketQuoteState>({
    type: "idle"
  });
  const [marketQuoteRefresh, setMarketQuoteRefresh] = useState(0);

  const selectedTile = useStore(interactionStore, state => state.selectedTile);
  const carriedItem = useStore(farmerCommandStore, state => state.carriedItem);
  const farmState = useStore(farmStore, state => state.farm);
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
          .reduce(
            (quantity, building) => quantity + building.storedBarley,
            0
          )
      : 0;
  const carriedBarley =
    carriedItem?.itemKey === "barley" ? carriedItem.quantity : 0;
  const exposedBarley =
    farmState.type === "ready"
      ? farmState.snapshot.groundItems
          .filter(item => item.itemKey === "barley")
          .reduce((quantity, item) => quantity + item.quantity, 0)
      : 0;
  const totalBarley =
    storedBarley + granaryBarley + carriedBarley + exposedBarley;
  const carriedReed =
    carriedItem?.itemKey === "reed" ? carriedItem.quantity : 0;
  const carriedClay =
    carriedItem?.itemKey === "clay" ? carriedItem.quantity : 0;
  const totalReed = availableReed + carriedReed;
  const totalClay = availableClay + carriedClay;
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
    farmState.type === "ready"
      ? storedBarley + granaryBarley
      : 0;
  const householdBarleyCapacity =
    farmState.type === "ready"
      ? calculateFarmStorageCapacity(
          farmState.snapshot.buildings,
          storageClock
        )
      : FARM_STORAGE_CAPACITY;
  const availableBarleyStorage = Math.max(
    0,
    householdBarleyCapacity - storedHouseholdBarley
  );
  const householdStatus =
    farmState.type !== "ready" ||
    farmState.snapshot.farm.household.cultivationStartedAt === null
      ? null
      : farmState.snapshot.farm.household.hungrySince !== null
        ? "Household is hungry"
        : `Food: ${storedHouseholdBarley} barley · next ration in ${formatRemainingTime(
            farmState.snapshot.farm.household.nextBarleyConsumptionAt!,
            storageClock
          )}`;

  const clearSelection = useStore(
    interactionStore,
    state => state.clearSelection
  );

  const isOpenTilePopover = selectedTile !== null;

  const selectedTileSize =
    selectedTile?.type === "farm" || selectedTile?.type === "granary"
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

    return match(tile.type)
      .with("ground", () => {
        const isRiverBank = isNextToRiver(tile);
        const canBuildIrrigation = isNextToIrrigationSource(tile);

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
              {!isRiverBank && !canBuildIrrigation && (
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
        const canBuildIrrigation = isNextToIrrigationSource(tile);
        const isIrrigated = isNextToIrrigationCanal(tile);
        const canPlantBarley =
          carriedItem?.itemKey === "barley" && isIrrigated;
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
                carriedItem.itemKey !== "barley" && (
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
      .with("granary", () => (
        <div className={styles["tile-popover-content"]}>
          <div className={styles["tile-popover-content-header"]}>
            <span>Granary</span>
          </div>
          <div className={styles["tile-popover-content-body"]}>
            Adds 15 barley storage when construction is complete
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
                  <button
                    disabled={
                      selectedGranary.storedBarley === 0 || carriedItem !== null
                    }
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
                      : carriedItem !== null
                        ? "The farmer is already carrying barley."
                        : "Take 1 Barley"}
                  </button>
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

    void fetchMarketQuotes(controller.signal).then(
      quotes => {
        setMarketQuoteState({ type: "ready", quotes });
      },
      error => {
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
    const timer = window.setInterval(() => {
      setStorageClock(Date.now());
    }, 60_000);

    return () => {
      window.clearInterval(timer);
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
    const nextDeadline = deadlines.toSorted((first, second) => first - second)[0];

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
        {householdStatus !== null && (
          <div className={styles["household-status"]} role="status">
            {householdStatus}
          </div>
        )}
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
                    <h3>Currency</h3>
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
                        <dt>Carried by farmer</dt>
                        <dd>{carriedBarley}</dd>
                      </div>
                      <div>
                        <dt>Exposed on the ground</dt>
                        <dd>{exposedBarley}</dd>
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
            <Dialog.Title>Market</Dialog.Title>
            <Dialog.Description>
              Buy and sell safely stored goods at the current NPC market
              prices.
            </Dialog.Description>
            {farmState.type === "ready" && marketQuoteState.type === "ready" ? (
              <div className={styles["market-trade"]}>
                <dl className={styles["market-balances"]}>
                  <div>
                    <dt>Shekels</dt>
                    <dd>{farmState.snapshot.player.shekelBalance}</dd>
                  </div>
                  <div>
                    <dt>Stored barley</dt>
                    <dd>
                      {storedHouseholdBarley} / {householdBarleyCapacity}
                    </dd>
                  </div>
                </dl>

                {marketQuoteState.quotes.items.map(item => {
                  const storedQuantity = match(item.itemKey)
                    .with("barley", () => storedHouseholdBarley)
                    .exhaustive();
                  const availableStorage = match(item.storageType)
                    .with("barley_storage", () => availableBarleyStorage)
                    .exhaustive();
                  const purchaseCost =
                    marketQuantity * item.npcMarket.buyPrice;
                  const saleValue =
                    marketQuantity * item.npcMarket.sellPrice;

                  return (
                    <section
                      className={styles["market-item"]}
                      key={item.itemKey}
                    >
                      <h3>{item.label}</h3>
                      <p>
                        Buy for {formatShekels(item.npcMarket.buyPrice)} · Sell
                        for {formatShekels(item.npcMarket.sellPrice)}
                      </p>
                      <label className={styles["market-quantity"]}>
                        Quantity
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
                      <div className={styles["market-actions"]}>
                        <button
                          disabled={
                            marketTradePending ||
                            !item.npcMarket.canBuy ||
                            farmState.snapshot.player.shekelBalance <
                              purchaseCost ||
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
                            : farmState.snapshot.player.shekelBalance <
                                purchaseCost
                              ? "Not enough shekels"
                              : `Buy for ${formatShekels(purchaseCost)}`}
                        </button>
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
                              item.npcMarket.sellPrice
                            );
                          }}
                        >
                          {!item.npcMarket.canSell
                            ? "Selling unavailable"
                            : storedQuantity < marketQuantity
                            ? `Not enough stored ${item.label.toLowerCase()}`
                            : `Sell for ${formatShekels(saleValue)}`}
                        </button>
                      </div>
                      {marketTradeError !== null && (
                        <p className={styles["market-error"]} role="alert">
                          {marketTradeError}
                        </p>
                      )}
                      <p>
                        {item.playerMarket.lowestSellPrice === null &&
                        item.playerMarket.highestBuyPrice === null
                          ? "There are no player market orders yet."
                          : "Player market orders are available."}
                      </p>
                    </section>
                  );
                })}
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
