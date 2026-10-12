import EstateManagementContent from "./EstateManagementContent";
import MarketDialog from "./MarketDialog";
import { farmerProductionJob } from "../../game-core/farm/farmerProduction";
import { OPEN_BUILD_DRAWER } from "../api/buildingReadiness";
import { improvementWorkActive } from "../../game-data/farmImprovements";
import { isClearableScenery } from "../../game-data/farmObjects";
import TileActionButton from "./TileActionButton";
import PerennialCropContent, {
  PerennialCropAction
} from "./PerennialCropContent";
import { cropWorkActive } from "../../game-core/farm/perennialCrops";
import ProductionStoreButton from "./ProductionStoreButton";
import { TileActionsBusy } from "./tileActionsBusy";
import {
  plantableFields,
  harvestableFields
} from "../../game-core/farm/batchPlanting";
import { batchPlantingStore } from "../stores/batchPlantingStore";
import BatchPlantingControls from "./BatchPlantingControls";
import BuildingStorageTables from "./BuildingStorageTables";
import { useEffect, useRef, useState } from "react";
import granaryImage from "../../assets/sprite_assets/pngs/granary.png";
import breweryImage from "../../assets/sprite_assets/pngs/brewery.png";
import breadOvenImage from "../../assets/sprite_assets/pngs/bread-oven-idle.png";
import smallShrineImage from "../../assets/sprite_assets/pngs/small-shrine.png";
import warehouseImage from "../../assets/sprite_assets/pngs/warehouse.png";
import { estateResourceCapacity } from "../../game-data/storage";
import ShrineContent from "./ShrineContent";
import HappinessMeter from "./HappinessMeter";
import RationMeter from "./RationMeter";
import LeaderboardDialog from "./LeaderboardDialog";
import MillContent from "./MillContent";
import BuildingUpgradeContent, {
  BuildingLevelSign
} from "./BuildingUpgradeContent";
import { durationLabel } from "./durationLabel";
import {
  buildingLevel,
  buildingProductionMultiplier
} from "../../game-data/buildingUpgrades";
import BreadOvenContent from "./BreadOvenContent";
import millImage from "../../assets/sprite_assets/pngs/empty-mill.png";
import { Dialog, Popover } from "radix-ui";
import {
  Cross2Icon,
  ExternalLinkIcon,
  ExclamationTriangleIcon
} from "@radix-ui/react-icons";
import { match } from "ts-pattern";
import styles from "../styles/GameCanvas.module.scss";
import {
  farmWorldToCanvasY,
  farmScrollContentHeight
} from "../game/phaser/farmViewport";
import { GAME_CONTAINER_ID, TILE_SIZE } from "../game/phaser/config";
import { createGame } from "../game/phaser/game";
import { MainScene } from "../game/phaser/scenes/MainScene";
import SumerMapControls from "./SumerMapControls";
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
import MerchantRequests from "./MerchantRequests";
import FarmLevelDialog from "./FarmLevelDialog";
import {
  granaryLimitForLevel
} from "../../game-data/progression";
import FishingControls from "./FishingControls";
import FetchControls from "./FetchControls";
import { fetchStore } from "../stores/fetchStore";
import { FISH_CAPACITY } from "../../game-data/fishing";
import { fetchDevelopmentFarm } from "../api/developmentPlayer";
import {
  MARKET_ITEM_DEFINITIONS
} from "../../game-data/marketItems";
import { farmStore } from "../stores/farmStore";
import { buildingPlacementStore } from "../stores/buildingPlacementStore";
import {
  marketUiStore
} from "../stores/marketUiStore";
import {
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

export default function GameCanvas() {
  const [isOpenManageDialog, setIsOpenManageDialog] = useState(false);
  const [manageTab, setManageTab] = useState("build");
  useEffect(() => {
    const openBuild = () => { setManageTab("build"); setIsOpenManageDialog(true); };
    window.addEventListener(OPEN_BUILD_DRAWER, openBuild);
    return () => window.removeEventListener(OPEN_BUILD_DRAWER, openBuild);
  }, []);
  const gameRef = useRef<ReturnType<typeof createGame> | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [farmScrollTop, setFarmScrollTop] = useState(0);
  const [canvasBoundary, setCanvasBoundary] = useState<HTMLDivElement | null>(
    null
  );
  const [destroyMaterialPending, setDestroyMaterialPending] = useState(false);
  const [destroyMaterialError, setDestroyMaterialError] = useState<{
    id: string;
    message: string;
  } | null>(null);
  const [storageClock, setStorageClock] = useState(() => Date.now());
  const selectedTile = useStore(interactionStore, state => state.selectedTile);
  const carriedItem = useStore(farmerCommandStore, state => state.carriedItem);
  const farmerStatus = useStore(farmerCommandStore, state => state.status.type);
  const farmState = useStore(farmStore, state => state.farm);
  const cropWork =
    farmState.type === "ready"
      ? farmState.snapshot.farm.production.cropWork
      : null;
  useEffect(() => {
    if (!cropWork || cropWork.settled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const snapshot = await fetchDevelopmentFarm();
        const current = farmStore.getState().farm;
        if (
          !cancelled &&
          current.type === "ready" &&
          snapshot.farm.id === current.snapshot.farm.id &&
          snapshot.farm.version >= current.snapshot.farm.version
        )
          farmStore.getState().setReady(snapshot);
      } catch (error) {
        console.error("Could not refresh crop work", error);
      }
      if (!cancelled) timer = setTimeout(refresh, 1000);
    };
    timer = setTimeout(
      refresh,
      Math.max(0, cropWork.completesAt - Date.now()) + 50
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [cropWork]);
  const tileActionsBusy =
    (farmerStatus !== "idle" && farmerStatus !== "failed") ||
    (farmState.type === "ready" &&
      !!(
        farmerProductionJob(farmState.snapshot.farm) ||
        cropWorkActive(farmState.snapshot) ||
        farmState.snapshot.farm.production.planting ||
        farmState.snapshot.farm.production.materialDelivery ||
        farmState.snapshot.farm.production.delivery ||
        farmState.snapshot.farm.millGoods.delivery ||
        farmState.snapshot.farm.gathering ||
        farmState.snapshot.farm.fishing ||
        farmState.snapshot.crops.some(
          c =>
            c.harvestStartedAt !== null ||
            Date.parse(c.plantedAt) > storageClock
        ) ||
        farmState.snapshot.buildings.some(
          b => Date.parse(b.completesAt) > storageClock
        ) ||
        farmState.snapshot.improvements.some(
          i => improvementWorkActive(i, storageClock)
        ) ||
        farmState.snapshot.farm.roads.some(
          r => (r.completesAt ?? 0) > storageClock
        )
      ));
  const fetchActive = useStore(fetchStore, state => state.phase !== "idle");
  const farmLevel =
    farmState.type === "ready"
      ? (farmState.snapshot.farm.progression?.level ?? 1)
      : 1;
  const marketSceneVisible = useStore(
    marketUiStore,
    state => state.location !== "farm"
  );
  const sumerVisible = useStore(
    marketUiStore,
    state => state.location === "sumer"
  );
  const mapInputWasEnabled = useRef(true);
  const openSumer = () => {
    const game = gameRef.current;
    if (!game || marketUiStore.getState().location !== "farm") return;
    const main = game.scene.getScene("main-scene");
    mapInputWasEnabled.current = main.input.enabled;
    main.input.enabled = false;
    main.scene.setVisible(false);
    clearSelection();
    setIsOpenManageDialog(false);
    batchPlantingStore.getState().cancel();
    marketUiStore.getState().setLocation("sumer");
    game.scene.start("sumer-scene");
  };
  const closeSumer = () => {
    const game = gameRef.current;
    if (!game) return;
    game.scene.stop("sumer-scene");
    const main = game.scene.getScene("main-scene");
    main.scene.setVisible(true);
    main.input.enabled = mapInputWasEnabled.current;
    marketUiStore.getState().setLocation("farm");
  };
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    gameRef.current?.scale.updateBounds();
  }, [marketSceneVisible]);
  const storedBarley =
    farmState.type === "ready"
      ? (farmState.snapshot.inventory.find(item => item.itemKey === "barley")
          ?.quantity ?? 0)
      : 0;
  const availableReed =
    farmState.type === "ready"
      ? [...farmState.snapshot.groundItems, ...farmState.snapshot.inventory]
          .filter(item => item.itemKey === "reed")
          .reduce((quantity, item) => quantity + item.quantity, 0)
      : 0;
  const availableClay =
    farmState.type === "ready"
      ? [...farmState.snapshot.groundItems, ...farmState.snapshot.inventory]
          .filter(item => item.itemKey === "clay")
          .reduce((quantity, item) => quantity + item.quantity, 0)
      : 0;
  const barleyStorageFull =
    storedBarley >= FARM_STORAGE_CAPACITY &&
    !(
      farmState.type === "ready" &&
      farmState.snapshot.buildings.some(
        building =>
          (building.type === "granary" || building.type === "warehouse") &&
          Date.parse(building.completesAt) <= storageClock &&
          building.storedBarley <
            (building.type === "warehouse"
              ? 20
              : granaryCapacityForLevel(
                  farmState.snapshot.farm.progression?.level ?? 1
                ))
      )
    );
  const warehouseComplete =
    farmState.type === "ready" &&
    farmState.snapshot.buildings.some(
      building =>
        building.type === "warehouse" &&
        Date.parse(building.completesAt) <= storageClock
    );
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
  const hasMill =
    farmState.type === "ready" &&
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
  const hasBrewery =
    farmState.type === "ready" &&
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
  const hasBreadOven =
    farmState.type === "ready" &&
    farmState.snapshot.buildings.some(
      building => building.type === "breadOven"
    );
  const hasShrine =
    farmState.type === "ready" &&
    farmState.snapshot.buildings.some(b => b.type === "smallShrine");
  const hasWarehouse =
    farmState.type === "ready" &&
    farmState.snapshot.buildings.some(b => b.type === "warehouse");
  const warehouseDefinition = FARM_BUILDING_DEFINITIONS.warehouse;
  const canBuildWarehouse =
    farmState.type === "ready" &&
    farmLevel >= 8 &&
    !hasWarehouse &&
    carriedItem === null &&
    !farmerProductionJob(farmState.snapshot.farm) &&
    availableReed >= warehouseDefinition.materials.reed &&
    availableClay >= warehouseDefinition.materials.clay;
  const shrineDefinition = FARM_BUILDING_DEFINITIONS.smallShrine;
  const canBuildShrine =
    !hasShrine &&
    farmLevel >= 8 &&
    carriedItem === null &&
    (farmerStatus === "idle" || farmerStatus === "failed") &&
    farmState.type === "ready" &&
    !farmerProductionJob(farmState.snapshot.farm) &&
    !farmState.snapshot.farm.production.planting &&
    !farmState.snapshot.farm.production.delivery &&
    !farmState.snapshot.farm.millGoods.delivery &&
    availableReed >= shrineDefinition.materials.reed &&
    availableClay >= shrineDefinition.materials.clay;
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
    (selectedTile?.type === "granary" || selectedTile?.type === "warehouse") &&
    farmBuildingTile !== undefined
      ? farmState.snapshot.buildings.find(
          building =>
            (building.type === "granary" || building.type === "warehouse") &&
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
        (building.type === "granary" || building.type === "warehouse") &&
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
          (candidate?.type === "granary" || candidate?.type === "warehouse") &&
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
  const clearSelection = useStore(
    interactionStore,
    state => state.clearSelection
  );

  const isOpenTilePopover = selectedTile !== null;

  const selectedTileSize =
    selectedTile?.type === "farm" ||
    selectedTile?.type === "granary" ||
    selectedTile?.type === "warehouse" ||
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
      : selectedTile.position.posY +
        (showPopoverBelow ? selectedTileSize : 0) +
        (marketSceneVisible
          ? 0
          : farmWorldToCanvasY(0, TILE_SIZE) - farmScrollTop);

  const addCommand = (command: FarmerCommandInput): void => {
    farmerCommandStore.getState().addCommand(command);
    clearSelection();
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
    if (
      farmState.snapshot.objects.some(
        object =>
          object.column === local.column &&
          object.row === local.row &&
          !isClearableScenery(object.type)
      )
    )
      return null;
    return (
      <TileActionButton
        onClick={() =>
          addCommand({
            type: "build",
            target: tile.position,
            build: "irrigation"
          })
        }
      >
        Build Irrigation
      </TileActionButton>
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
      new Set(
        farmState.snapshot.objects
          .filter(object => !isClearableScenery(object.type))
          .map(object => `${object.column}:${object.row}`)
      )
    ) === null ? (
      <TileActionButton
        onClick={() =>
          addCommand({ type: "build", build: "road", target: tile.position })
        }
      >
        Build road
      </TileActionButton>
    ) : null;
  };

  const displayPopoverContent = (tile: typeof selectedTile) => {
    if (
      tile?.type === "smallShrine" &&
      tile.buildingId &&
      farmState.type === "ready"
    ) {
      return (
        <ShrineContent
          snapshot={farmState.snapshot}
          buildingId={tile.buildingId}
          target={tile.position}
          now={storageClock}
          busy={
            !!farmState.snapshot.farm.production.planting ||
            (farmerStatus !== "idle" && farmerStatus !== "failed")
          }
          addCommand={addCommand}
        />
      );
    }
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
              The farmer delivers what fits to storage. Remaining goods stay
              here.
            </p>
            {busy && <p>Finish the current task and empty your hands first.</p>}
            <ProductionStoreButton
              snapshot={snapshot}
              item={stack?.itemKey}
              now={storageClock}
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
            />
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
            <TileActionButton
              onClick={() =>
                addCommand({
                  type: "store_mill_goods",
                  target: tile.position,
                  millId: delivery.millId
                })
              }
            >
              Store
            </TileActionButton>
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
            {carriedItem && <p>Empty the farmer's hands first.</p>}
            <ProductionStoreButton
              snapshot={snapshot}
              items={(["flour", "brewersGroats"] as const).filter(
                item => (bags?.[item] ?? 0) > 0
              )}
              now={storageClock}
              disabled={
                !bags ||
                bags.flour + bags.brewersGroats === 0 ||
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
            />
          </div>
        </div>
      );
    }
    if (tile?.type === "mill" && farmState.type === "ready")
      return (
        <MillContent
          key={tile.buildingId}
          buildingId={tile.buildingId}
          snapshot={farmState.snapshot}
          target={tile.position}
          now={storageClock}
          addCommand={addCommand}
        />
      );
    if (!tile) return <span>No tile selected</span>;
    if (!tileActionsBusy && carriedItem?.itemKey === "fish") {
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
                <TileActionButton
                  onClick={() =>
                    addCommand({
                      type: "fishing",
                      action: "store",
                      target: tile.position
                    })
                  }
                >
                  Store fish
                </TileActionButton>
              ) : (
                <p role="alert">
                  Fish storage is full. Release the fish at the river.
                </p>
              )}
            </>
          ) : tile.type === "water" ? (
            <TileActionButton
              onClick={() =>
                addCommand({
                  type: "fishing",
                  action: "release",
                  target: tile.position
                })
              }
            >
              Release fish
            </TileActionButton>
          ) : (
            <p>Bring the fish to the farm or release it at the river.</p>
          )}
        </div>
      );
    }

    if (
      !tileActionsBusy &&
      carriedItem?.itemKey === "water" &&
      tile.type !== "brewery"
    ) {
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
              <TileActionButton
                onClick={() =>
                  addCommand({
                    type: "brewery_supply",
                    action: "pour_water",
                    target: tile.position
                  })
                }
              >
                Pour out water
              </TileActionButton>
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
            <span>A road connecting buildings.</span>
            <TileActionButton
              onClick={() =>
                addCommand({ type: "move", target: tile.position })
              }
            >
              Walk
            </TileActionButton>
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
        const clayStorageFull =
          farmState.type === "ready" &&
          (farmState.snapshot.inventory.find(item => item.itemKey === "clay")
            ?.quantity ?? 0) +
            (farmState.snapshot.farm.production.materialReservation === "clay"
              ? 1
              : 0) >=
            estateResourceCapacity(
              "clay",
              farmState.snapshot.buildings,
              storageClock
            );
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
                <TileActionButton
                  disabled={clayStorageFull || carriedItem !== null}
                  onClick={() =>
                    addCommand({
                      type: "gather",
                      target: tile.position,
                      item: "clay"
                    })
                  }
                >
                  {clayStorageFull
                    ? "Clay storage is full"
                    : carriedItem === null
                      ? "Collect Clay"
                      : "Empty your hands first"}
                </TileActionButton>
              )}
              {canBuildIrrigation && buildIrrigationButton(tile)}
              {carriedItem === null && !isRiverBank && !canBuildIrrigation && (
                <TileActionButton
                  onClick={() =>
                    addCommand({
                      type: "inspect",
                      target: tile
                    })
                  }
                >
                  Inspect
                </TileActionButton>
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
        const canRetrieveBarley =
          carriedItem === null &&
          barleyWithdrawalSource !== null &&
          isIrrigated;
        const canDropCarriedItem =
          carriedItem !== null &&
          carriedItem.itemKey !== "reed" &&
          carriedItem.itemKey !== "clay";
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
              {isIrrigated && farmLevel >= 9 && farmState.type === "ready" && (
                <PerennialCropAction
                  snapshot={farmState.snapshot}
                  cropKey="datePalm"
                  target={localTilePosition(tile)}
                  now={storageClock}
                  action="plant"
                />
              )}
              {!isIrrigated && (
                <span>
                  Build an irrigation canal next to this tile and connect it to
                  the river to grow barley here.
                </span>
              )}
              {isIrrigated &&
                farmState.type === "ready" &&
                plantableFields(farmState.snapshot, storageClock).length >=
                  1 && (
                  <TileActionButton
                    disabled={
                      (carriedItem !== null &&
                        carriedItem.itemKey !== "barley") ||
                      farmerCommandStore.getState().status.type !== "idle" ||
                      !!farmState.snapshot.farm.production.planting
                    }
                    onClick={() => {
                      clearSelection();
                      batchPlantingStore.getState().start();
                    }}
                  >
                    Plant barley
                  </TileActionButton>
                )}
              {canRetrieveBarley && (
                <TileActionButton
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
                </TileActionButton>
              )}
              {isIrrigated &&
                carriedItem === null &&
                barleyWithdrawalSource === null && (
                  <TileActionButton disabled>
                    No stored barley available
                  </TileActionButton>
                )}
              {isIrrigated &&
                carriedItem !== null &&
                carriedItem.itemKey !== "barley" &&
                carriedItem.itemKey !== "reed" && (
                  <TileActionButton disabled>
                    Empty your hands before planting
                  </TileActionButton>
                )}
              {canDropCarriedItem && (
                <TileActionButton
                  onClick={() =>
                    addCommand({
                      type: "drop",
                      target: tile.position
                    })
                  }
                >
                  Drop 1 {carriedItem.itemKey}
                </TileActionButton>
              )}
              {canBuildIrrigation && buildIrrigationButton(tile)}
              {buildRoadButton(tile)}
              {!hasTileAction && (
                <TileActionButton
                  onClick={() =>
                    addCommand({
                      type: "inspect",
                      target: tile
                    })
                  }
                >
                  Inspect
                </TileActionButton>
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
            <TileActionButton
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
            </TileActionButton>
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
              <TileActionButton
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
              </TileActionButton>
              <TileActionButton
                disabled={destroyMaterialPending || !groundItem}
                onClick={() => {
                  void destroy();
                }}
              >
                {destroyMaterialPending ? "Destroying…" : "Destroy"}
              </TileActionButton>
            </div>
          </div>
        );
      })
      .with("reeds", () => {
        const reedStorageFull =
          farmState.type === "ready" &&
          (farmState.snapshot.inventory.find(item => item.itemKey === "reed")
            ?.quantity ?? 0) +
            (farmState.snapshot.farm.production.materialReservation === "reed"
              ? 1
              : 0) >=
            estateResourceCapacity(
              "reed",
              farmState.snapshot.buildings,
              storageClock
            );
        return (
          <div className={styles["tile-popover-content"]}>
            <div className={styles["tile-popover-content-header"]}>
              <span>River reeds</span>
            </div>
            <div className={styles["tile-popover-content-body"]}>
              Reeds suitable for construction
              <TileActionButton
                disabled={reedStorageFull || carriedItem !== null}
                onClick={() =>
                  addCommand({
                    type: "gather",
                    target: tile.position,
                    item: "reed"
                  })
                }
              >
                {reedStorageFull
                  ? "Reed storage is full"
                  : carriedItem === null
                    ? "Collect Reeds"
                    : "Empty your hands first"}
              </TileActionButton>
            </div>
          </div>
        );
      })
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
      .with("datePalmSapling", "datePalmGrowing", "datePalmReady", () =>
        farmState.type === "ready" ? (
          <PerennialCropContent
            snapshot={farmState.snapshot}
            target={localTilePosition(tile)}
            now={storageClock}
          />
        ) : null
      )
      .with("barleyReady", () => (
        <div className={styles["tile-popover-content"]}>
          <div className={styles["tile-popover-content-header"]}>
            <span className="cuneiforms">𒊺</span>
            <span>Ripe barley</span>
          </div>
          <div className={styles["tile-popover-content-body"]}>
            The barley is ready to harvest
            <TileActionButton
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
            </TileActionButton>
            {farmState.type === "ready" &&
              harvestableFields(farmState.snapshot, storageClock).length >=
                2 && (
                <TileActionButton
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
                </TileActionButton>
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
            A building used for storage
            {farmState.type === "ready" && (
              <BuildingStorageTables
                location="farm"
                inventory={farmState.snapshot.inventory}
                barley={storedBarley}
                warehouseComplete={warehouseComplete}
                showFish={farmLevel >= 4}
                showDates={farmLevel >= 9}
              />
            )}
            {(carriedItem?.itemKey === "reed" ||
              carriedItem?.itemKey === "clay") && (
              <TileActionButton
                onClick={() =>
                  addCommand({
                    type: "deposit",
                    target: tile.position,
                    storage: "farm"
                  })
                }
              >
                Store {carriedItem.itemKey}
              </TileActionButton>
            )}
            {carriedItem?.itemKey === "barley" && (
              <TileActionButton
                disabled={barleyStorageFull}
                onClick={() =>
                  addCommand({
                    type: "deposit",
                    target: tile.position,
                    storage: "farm"
                  })
                }
              >
                {barleyStorageFull ? "Barley storage is full" : "Store Barley"}
              </TileActionButton>
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
          <TileActionButton
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
          </TileActionButton>
        );
        return (
          <div className={styles["tile-popover-content"]}>
            <div className={styles["tile-popover-content-header"]}>
              <span className="cuneiforms">𒂍𒋆</span>
              <span>Brewery</span>
              {brewery && farmState.type === "ready" && (
                <BuildingLevelSign
                  snapshot={farmState.snapshot}
                  buildingId={brewery.id}
                  now={storageClock}
                />
              )}
            </div>
            <div className={styles["tile-popover-content-body"]}>
              {!complete || farmState.type !== "ready" ? (
                "Under construction"
              ) : (
                <BuildingUpgradeContent
                  key={brewery.id}
                  snapshot={farmState.snapshot}
                  buildingId={brewery.id}
                  now={storageClock}
                >
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
                    2 groats + 2 water loads + 2 empty jars → 2 beer ·{" "}
                    {durationLabel(
                      BEER_RECIPE.durationMs *
                        buildingProductionMultiplier(
                          "brewery",
                          buildingLevel(
                            farmState.snapshot.farm.production.buildingUpgrades,
                            brewery.id,
                            storageClock
                          )
                        )
                    )}
                    . Groats are consumed from estate inventory when brewing
                    starts.
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
                    <TileActionButton
                      onClick={() =>
                        addCommand({
                          type: "brewery_supply",
                          action: "give_beer",
                          target: tile.position
                        })
                      }
                    >
                      Give 1 beer to the farmer (+15 happiness)
                    </TileActionButton>
                  ) : null}
                  {match(brewing)
                    .with({ type: "idle" }, () => (
                      <>
                        {brewRule === null ? (
                          <TileActionButton
                            onClick={() =>
                              addCommand({
                                type: "brewery_supply",
                                action: "start_brewing",
                                target: tile.position
                              })
                            }
                          >
                            Start brewing
                          </TileActionButton>
                        ) : null}
                      </>
                    ))
                    .with({ type: "brewing" }, () => null)
                    .with({ type: "ready" }, () => null)
                    .exhaustive()}
                  {carriedItem === null &&
                  availableEmptyBeerJars === 0 &&
                  brewery.emptyBeerJars < BREWERY_EMPTY_JAR_CAPACITY ? (
                    <TileActionButton
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
                    </TileActionButton>
                  ) : (
                    carriedItem === null && (
                      <TileActionButton
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
                      </TileActionButton>
                    )
                  )}
                  {carriedItem?.itemKey !== "water" && deliveryButton}
                </BuildingUpgradeContent>
              )}
            </div>
          </div>
        );
      })
      .with("warehouse", () => (
        <div className={styles["tile-popover-content"]}>
          <div className={styles["tile-popover-content-header"]}>
            <span className="cuneiforms">𒉌𒁾</span>
            <span>Warehouse</span>
          </div>
          <div className={styles["tile-popover-content-body"]}>
            A building used for storage
            {farmState.type === "ready" && selectedGranary !== undefined && (
              <BuildingStorageTables
                location="warehouse"
                showDates={farmLevel >= 9}
                inventory={farmState.snapshot.inventory}
                barley={selectedGranary.storedBarley}
                warehouseComplete={warehouseComplete}
              />
            )}
          </div>
        </div>
      ))
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
                    <TileActionButton
                      disabled={barleyStorageFull}
                      onClick={() =>
                        addCommand({
                          type: "deposit",
                          target: tile.position,
                          storage: "granary"
                        })
                      }
                    >
                      {barleyStorageFull
                        ? "Barley storage is full"
                        : "Store Barley"}
                    </TileActionButton>
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
                    <TileActionButton
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
                    </TileActionButton>
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
                <TileActionButton
                  onClick={() =>
                    addCommand({
                      type: "fishing",
                      action: "start",
                      target: tile.position
                    })
                  }
                >
                  Go fishing
                </TileActionButton>
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
                <TileActionButton
                  onClick={() =>
                    addCommand({
                      type: "brewery_supply",
                      action: "collect_water",
                      target: tile.position
                    })
                  }
                >
                  Collect water
                </TileActionButton>
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
              <TileActionButton
                onClick={() =>
                  addCommand({
                    type: "destroy",
                    target: tile.position,
                    build: "irrigation"
                  })
                }
              >
                Destroy
              </TileActionButton>
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
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
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
        gameRef.current = game;
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
      gameRef.current = null;
    };
  }, []);

  return (
    <>
      {!marketSceneVisible && <FishingControls />}
      <FarmLevelDialog />
      <LeaderboardDialog />
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
              <button
                className="with-shadow"
                style={{ padding: "8px 16px" }}
                onClick={openSumer}
                disabled={farmState.type !== "ready"}
              >
                📍 Sumer
              </button>
            </div>
          )}
          <div
            ref={scrollRef}
            data-farm-viewport
            className={styles["game-viewport"]}
            aria-label="Farm view"
            tabIndex={0}
            onScroll={event => {
              setFarmScrollTop(event.currentTarget.scrollTop);
              clearSelection();
              gameRef.current?.scale.updateBounds();
            }}
          >
            <div
              id={GAME_CONTAINER_ID}
              className={styles["game-container"]}
              style={{
                minHeight: marketSceneVisible
                  ? 0
                  : farmScrollContentHeight(
                      INITIAL_FARM_CONFIG.riverRow,
                      TILE_SIZE
                    )
              }}
            />
          </div>
          {!marketSceneVisible && <BatchPlantingControls now={storageClock} />}
          {sumerVisible && <SumerMapControls onBack={closeSumer} />}
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
                  maxWidth: `min(${TILE_SIZE * 6}px, calc(100vw - 24px), var(--radix-popover-content-available-width))`
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
                <TileActionsBusy.Provider value={tileActionsBusy}>
                  {displayPopoverContent(selectedTile)}
                </TileActionsBusy.Provider>
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
        <EstateManagementContent farmState={farmState} storageClock={storageClock}
          manageTab={manageTab} setManageTab={setManageTab} buildContent={<>
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
                  <EstateBuildingCard name="Granary" image={granaryImage}>
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
                    {granaryCount < 1 && farmLevel >= 2 && !canBuildGranary && (
                      <p>
                        {availableReed <
                          FARM_BUILDING_DEFINITIONS.granary.materials.reed ||
                        availableClay <
                          FARM_BUILDING_DEFINITIONS.granary.materials.clay
                          ? "Gather the required reeds and clay to build this granary."
                          : "Finish the farmer’s current task before building."}
                      </p>
                    )}
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
                      {granaryCount >= 1
                        ? "Already built"
                        : farmLevel < 2
                          ? "Unlock at level 2"
                          : "Build granary"}
                    </button>
                  </EstateBuildingCard>
                  <EstateBuildingCard name="Mill" image={millImage}>
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
                  </EstateBuildingCard>
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
                        : farmLevel < 6
                          ? "Unlock at level 6"
                          : "Build brewery"}
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
                      deliver them to storage. Buy baking tools at the NPC
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
                        : farmLevel < 6
                          ? "Unlock at level 6"
                          : "Build Bread Oven"}
                    </button>
                  </li>
                  <li>
                    <h3 className={styles["building-title"]}>
                      <img
                        src={warehouseImage}
                        alt=""
                        width={48}
                        height={48}
                        draggable={false}
                      />
                      Warehouse
                    </h3>
                    <p>
                      2×2 · 3 minutes · {availableReed}/
                      {warehouseDefinition.materials.reed} reed ·{" "}
                      {availableClay}/{warehouseDefinition.materials.clay} clay
                    </p>
                    <p>
                      Stores 20 barley. Adds 10 storage each for bread, beer,
                      flour, groats, reed and clay.
                    </p>
                    {!hasWarehouse && farmLevel >= 8 && !canBuildWarehouse && (
                      <p>
                        Gather the required materials and finish the farmer’s
                        current task with empty hands.
                      </p>
                    )}
                    <button
                      disabled={!canBuildWarehouse}
                      onClick={() => {
                        clearSelection();
                        buildingPlacementStore
                          .getState()
                          .startPlacement("warehouse");
                        setIsOpenManageDialog(false);
                      }}
                    >
                      {hasWarehouse
                        ? "Already built"
                        : farmLevel < 8
                          ? "Unlock at level 8"
                          : "Build Warehouse"}
                    </button>
                  </li>
                  <li>
                    <h3 className={styles["building-title"]}>
                      <img
                        src={smallShrineImage}
                        alt=""
                        width={48}
                        height={48}
                        draggable={false}
                      />
                      Small shrine
                    </h3>
                    <p>
                      1×1 · {shrineDefinition.constructionDurationMs / 60000}{" "}
                      minutes · {availableReed}/
                      {shrineDefinition.materials.reed} reed · {availableClay}/
                      {shrineDefinition.materials.clay} clay
                    </p>
                    <p>
                      Offer 2 bread or 2 beer to slow happiness decay by 25% for
                      12 hours. One shrine per farm.
                    </p>
                    {!hasShrine && farmLevel >= 8 && !canBuildShrine && (
                      <p>
                        Gather the required materials and finish the farmer’s
                        current task.
                      </p>
                    )}
                    <button
                      disabled={!canBuildShrine}
                      onClick={() => {
                        clearSelection();
                        buildingPlacementStore
                          .getState()
                          .startPlacement("smallShrine");
                        setIsOpenManageDialog(false);
                      }}
                    >
                      {hasShrine
                        ? "Already built"
                        : farmLevel < 8
                          ? "Unlock at level 8"
                          : "Build Small shrine"}
                    </button>
                  </li>
                </ul>
          </>} />
      </Dialog.Root>

      <MarketDialog />
    </>
  );
}
import EstateBuildingCard from "./EstateBuildingCard";
