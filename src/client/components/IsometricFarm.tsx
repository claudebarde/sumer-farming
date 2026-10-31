import { currentCropWork } from "../../game-data/cropWork";
import DecorationsPanel from "./DecorationsPanel";
import { sendDecoration } from "../api/decorations";
import { miniaturePlacementError } from "../../game-core/farm/miniaturePlacement";
import { nextCropTransition } from "../game/phaser/cropPresentation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Ziggurat } from "../../schemas/ziggurat";
import { renderDiagnostic } from "../game/phaser/renderDiagnostics";
import { shrineOfferingBlocker } from "../game/phaser/isometricShrine";
import Phaser from "phaser";
import { roadRemovalReason } from "../../game-core/farm/roads";
import type { FarmSnapshot } from "../../schemas/farm";
import { fetchDevelopmentFarm } from "../api/developmentPlayer";
import { executeGameCommand } from "../api/gameActions";
import { availableBarleyHarvestStorage, availableSesameHarvestStorage, availablePlantingSeeds, harvestingSelectionLimit, plantableFields, harvestableFields, plantingSelectionLimit, togglePlantingField, fieldKey } from "../../game-core/farm/batchPlanting";
import { lockedHarvestFieldLimit } from "../../game-core/farm/harvestCapacity";
import type { IsoCell } from "../game/phaser/isometricProjection";
import { plantingBlocker } from "../game/phaser/isometricPlanting";
import { harvestingBlocker, harvestSelectionMaximum } from "../game/phaser/isometricHarvesting";
import { isometricTilePopup } from "../game/phaser/isometricTilePopup";
import { improvementWorkActive } from "../../game-data/farmImprovements";
import { pickupPath } from "../game/phaser/isometricPickup";
import { constructionApproachPath } from "../game/phaser/isometricConstruction";
import { barleyStoragePlan, materialStoragePlan } from "../game/phaser/isometricStorage";
import { transferBlocker } from "../game/phaser/isometricGathering";
import { farmOrigin } from "../game/phaser/isometricFarm";
import { IsometricFarmScene, type IsometricTileAnchor } from "../game/phaser/scenes/IsometricFarmScene";
import IsometricTilePopup from "./IsometricTilePopup";
import IsometricTravelPopup from "./IsometricTravelPopup";
import { IsometricMarketScene } from "../game/phaser/scenes/IsometricMarketScene";
import { NeighbourhoodScene } from "../game/phaser/scenes/NeighbourhoodScene";
import ZigguratDialog from "./ZigguratDialog";
import { requestNeighbourhood } from "../api/neighbourhood";
import { NeighbourhoodLeaderboardDialog } from "./LeaderboardDialog";
import { canVisitIsometricMarket, isometricTradeScope, marketEntrance } from "../game/phaser/isometricMarket";
import styles from "../styles/IsometricTest.module.scss";
import actionStyles from "../styles/BuildingActionButton.module.scss";
import BuildingActionIcon from "./BuildingActionIcon";
import MarketDialog from "./MarketDialog";
import FarmLevelDialog from "./FarmLevelDialog";
import { constructionCommands, constructionNames, constructionSummary } from "../game/phaser/isometricBuildingPlacement";
import { claimFarmLevel } from "../api/claimFarmLevel";
import BarleyWorkProgress from "./BarleyWorkProgress";
import PalmPlantingProgress from "./PalmPlantingProgress";
import PalmHarvestProgress from "./PalmHarvestProgress";
import PalmPlantingConfirmation from "./PalmPlantingConfirmation";
import { sowingProgress } from "../game/phaser/isometricPlanting";
import { harvestingProgress } from "../game/phaser/isometricHarvesting";
import { levelUiStore } from "../stores/levelUiStore";
import { farmStore } from "../stores/farmStore";
import { notificationStore } from "../stores/notificationStore";
import { marketUiStore } from "../stores/marketUiStore";
import { canOpenMarketStand } from "../../game-data/progression";
import { Dialog, Tooltip } from "radix-ui";
import EstateManagementContent from "./EstateManagementContent";
import ShekelBalance from "./ShekelBalance";
import SettingsDrawer from "./SettingsDrawer";
import { BackgroundMusicScene } from "../game/phaser/scenes/BackgroundMusicScene";
import BarleyBalance from "./BarleyBalance";
import { storedPlantingBarley } from "../../game-core/farm/batchPlanting";
import IsometricBuildingCatalogue from "./IsometricBuildingCatalogue";
import DestroyBuildingDialog from "./DestroyBuildingDialog";
import { buildingBuildBlocker, buildingPlacement, type PlaceableBuilding } from "../game/phaser/isometricBuildingPlacement";
import type { MillRecipe, MillWorker } from "../../game-data/milling";
import { roadsideOutputPlacement } from "../game/phaser/buildingOutputPlacement";
import { canBakeBread, canStoreBread } from "../game/phaser/isometricBaking";
import { breweryOutputPlacement, canSupplyBrewery, waterPourTarget } from "../game/phaser/isometricBrewing";
import type { BrewerySupplyAction } from "../../game-core/farm/brewerySupplies";
import { physicalDeliveryStop } from "../../game-core/farm/physicalStorage";
import { porterStorageReservation } from "../../game-data/porter";
import { porterRoadRemovalReason } from "../../game-core/farm/porter";
import { buildingAt } from "../game/phaser/isometricFarm";
import { millPopupState } from "../game/phaser/isometricMilling";
import { canPickupMillBags, millPickupPath, millDeliveryDestination } from "../game/phaser/isometricMillDelivery";
import { describeBuildingPlacementRule } from "../../game-core/farm/buildings";
import { previewWalkPath } from "../game/phaser/isometricWalking";
import { sameCell } from "../game/phaser/isometricFarm";
import { OPEN_BUILD_DRAWER } from "../api/buildingReadiness";
import { gatheringPath } from "../game/phaser/isometricGathering";
import { canStartIsometricFishing, fishingApproach } from "../game/phaser/isometricFishing";
import { INITIAL_FARM_CONFIG } from "../../game-data/initialFarm";
import MerchantRequests from "./MerchantRequests";
import { useNavigationTooltip } from "./useNavigationTooltip";
import { newlyPurchasedDonkey } from "../game/phaser/donkeyFollow";
import { roadPlanBlocker, toggleRoadPlan, roadWorkActive } from "../game/phaser/isometricRoads";
import InfoAlert from "./InfoAlert";
import GameLoadingScreen from "./GameLoadingScreen";
import { monitorGameLoading, type GameLoadingState } from "../game/phaser/gameLoading";

export default function IsometricFarm() {
  const [gameLoading, setGameLoading] = useState<GameLoadingState>("loading");
  const navigationTooltip = useNavigationTooltip();
  const parent = useRef<HTMLDivElement>(null);
  const scene = useRef<IsometricFarmScene | null>(null);
  const marketScene = useRef<IsometricMarketScene | null>(null);
  const neighbourhoodScene = useRef<NeighbourhoodScene | null>(null);
  const updateZiggurat = useCallback((data: Ziggurat) => neighbourhoodScene.current?.setZigguratState(data), []);
  const [neighbourhoodOpen, setNeighbourhoodOpen] = useState(false);
  const [harvestPreview, setHarvestPreview] = useState(false);
  const [deliveryPreview, setDeliveryPreview] = useState(false);
  const [zigguratOpen, setZigguratOpen] = useState(false);
  const [neighbourhoodLoad, setNeighbourhoodLoad] = useState<"idle" | "loading" | "error">("idle");
  const neighbourhoodRequest = useRef<AbortController | null>(null);
  useEffect(() => () => neighbourhoodRequest.current?.abort(), []);
  const [neighbourhoodLeaderboardOpen, setNeighbourhoodLeaderboardOpen] = useState(false);
  const activeScene = useRef<IsometricFarmScene | IsometricMarketScene | NeighbourhoodScene | null>(null);
  const [location, setLocation] = useState<"farm" | "market">("farm");
  useEffect(() => {
    marketUiStore.getState().setLocation(location);
    levelUiStore.getState().setOpen(false);
  }, [location]);
  const [manageOpen, setManageOpen] = useState(false);
  const [manageTab, setManageTab] = useState("build");
  const [demolitionId, setDemolitionId] = useState<string | null>(null);
  const [placingBuilding, setPlacingBuilding] = useState(false);
  const [buildingType, setBuildingType] = useState<PlaceableBuilding>("granary");
  const [buildingTarget, setBuildingTarget] = useState<IsoCell | null>(null);
  const [buildingError, setBuildingError] = useState<string | null>(null);
  const refresh = useRef<() => void>(() => {});
  const accept = useRef<(snapshot: FarmSnapshot) => void>(() => {});
  const current = useRef<FarmSnapshot | null>(null);
  const selecting = useRef<readonly IsoCell[] | null>(null);
  const selectionMode = useRef<"plant" | "harvest" | "sesame" | "harvestSesame">("plant");
  const [mode, setMode] = useState<"plant" | "harvest" | "sesame" | "harvestSesame">("plant");
  const submitting = useRef(false);
  const mounted = useRef(false);
  const [snapshot, setSnapshot] = useState<FarmSnapshot | null>(null);
  const [selection, setSelection] = useState<readonly IsoCell[] | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fishingMessage, setFishingMessage] = useState("");
  const [fishingStatus, setFishingStatus] = useState("Getting ready…");
  const [decorationId,setDecorationId]=useState<string|null>(null);
  const [decorationTarget,setDecorationTarget]=useState<IsoCell|null>(null);
  const [decorationError,setDecorationError]=useState<string|null>(null);
  const [information, setInformation] = useState<IsometricTileAnchor | null>(null);
  const [palmTarget, setPalmTarget] = useState<IsoCell | null>(null);
  useEffect(() => {
    const renderer = scene.current;
    renderer?.setPalmConfirmationTarget(palmTarget);
    return () => renderer?.setPalmConfirmationTarget(null);
  }, [palmTarget]);
  const [clock, setClock] = useState(() => Date.now());
  const [placementFarmer, setPlacementFarmer] = useState<IsoCell>(farmOrigin);
  const [roadPlan, setRoadPlan] = useState<readonly IsoCell[] | null>(null);
  const [roadError, setRoadError] = useState<string | null>(null);
  const roadQueueStarted = useRef(false);
  const roadBuilding = !!snapshot && roadWorkActive(snapshot.farm.roads, clock);
  useEffect(() => {
    if (roadPlan === null) return;
    if (roadBuilding) roadQueueStarted.current = true;
    else if (roadQueueStarted.current) {
      roadQueueStarted.current = false;
      setRoadPlan(null); setRoadError(null);
      scene.current?.setRoadPlanning(null);
    }
  }, [roadBuilding, roadPlan]);
  useEffect(() => {
    scene.current?.setRoadPlanning(roadPlan, cell => {
      if (submitting.current || !current.current || roadPlan === null) return;
      if (roadWorkActive(current.current.farm.roads, Date.now())) return;
      const result = toggleRoadPlan(current.current, roadPlan, cell, Date.now());
      setRoadError(result.reason);
      if (!result.reason) setRoadPlan(result.tiles);
    });
  }, [roadPlan, snapshot]);
  const submitRoadPlan = async () => {
    const farm = current.current, renderer = scene.current;
    if (!farm || !renderer || !roadPlan?.length || submitting.current) return;
    const reason = roadPlanBlocker(farm, roadPlan, Date.now());
    if (reason) { setRoadError(reason); return; }
    submitting.current = true; setPending(true); setRoadError(null);
    try {
      const next = await executeGameCommand({ type: "build_road", target: roadPlan[0]!, targets: [...roadPlan],
        farmerPosition: renderer.farmerPosition(), expectedFarmVersion: farm.farm.version });
      if (mounted.current) { roadQueueStarted.current = true; accept.current(next); setRoadPlan([]); }
    } catch (cause) {
      if (mounted.current) setRoadError(cause instanceof Error ? cause.message : "Could not build this road.");
    } finally {
      submitting.current = false;
      if (mounted.current) { setPending(false); refresh.current(); }
    }
  };
  const castFish = async (aim: number) => {
    const farm = current.current, renderer = scene.current;
    if (!farm?.farm.fishing || !renderer || submitting.current) { renderer?.finishFishingCast(); return; }
    submitting.current = true; setPending(true); setFishingMessage("");
    try {
      const next = await executeGameCommand({ type: "cast_fishing", sessionId: farm.farm.fishing.id, aim });
      if (!mounted.current) return;
      accept.current(next);
      setFishingMessage(next.farm.carriedItem?.itemKey === "fish" ? "Caught a fish!" : "Missed.");
    } catch (cause) {
      if (mounted.current) setFishingMessage(cause instanceof Error ? cause.message : "The cast failed.");
    } finally {
      submitting.current = false; renderer.finishFishingCast();
      if (mounted.current) { setPending(false); refresh.current(); }
    }
  };
  const collectMillBags = async (millId: string) => {
    let farm = current.current;
    const renderer = scene.current;
    if (!farm || !renderer || submitting.current) return;
    if (!farm.farm.millGoods.delivery && !canPickupMillBags(farm, millId, Date.now())) return;
    submitting.current = true; setPending(true); setError(null);
    renderer.setPlantingSelection(null, true); renderer.clearSelection();
    const animate = async (path: readonly IsoCell[], building: IsoCell, carrying: boolean) => {
      const duration = renderer.presentMillDeliveryLeg(path, building, carrying);
      await new Promise<void>(resolve => window.setTimeout(resolve, duration));
      if (mounted.current) renderer.finishMillDeliveryLeg();
    };
    try {
      if (!farm.farm.millGoods.delivery) {
        const mill = farm.buildings.find(b => b.id === millId)!;
        const path = millPickupPath(farm, millId, renderer.farmerPosition(), Date.now());
        if (!path) throw new Error("No clear path to the mill.");
        // Walk empty-handed before collecting the server-owned pending stack.
        await animate(path, mill, false);
        if (!mounted.current) return;
        farm = await executeGameCommand({ type: "mill_delivery", action: "pickup", millId, expectedFarmVersion: current.current!.farm.version });
        accept.current(farm);
      }
      // Persisted bags remain carried on interruption; Store bags resumes delivery.
      for (let stop = 0; stop < 2 && farm.farm.millGoods.delivery; stop++) {
        const destination = millDeliveryDestination(farm, renderer.farmerPosition(), Date.now());
        if (!destination) throw new Error("No clear path to storage.");
        await animate(destination.path, destination.building, true);
        if (!mounted.current) return;
        farm = await executeGameCommand({ type: "mill_delivery", action: "store", millId: farm.farm.millGoods.delivery.millId, expectedFarmVersion: current.current!.farm.version });
        accept.current(farm);
      }
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "Could not deliver the bags.");
    } finally {
      submitting.current = false;
      if (mounted.current) { setPending(false); renderer.setPlantingSelection(null, false); refresh.current(); }
    }
  };
  const storeBread = async (id: string) => {
    let farm = current.current;
    const renderer = scene.current;
    if (!farm || !renderer || submitting.current) return;
    if (!farm.farm.production.delivery && !canStoreBread(farm, id, Date.now())) return;
    const oven = farm.buildings.find(b => b.id === id);
    if (!oven) return;
    const itemKey = oven.type === "brewery" ? "beer" : "bread";
    submitting.current = true; setPending(true); setError(null);
    renderer.setPlantingSelection(null, true); renderer.clearSelection();
    const travel = async (target: IsoCell, building: IsoCell, carrying: boolean) => {
      const path = pickupPath(current.current!, renderer.farmerPosition(), target, Date.now());
      if (!path) throw new Error("No clear path to the loading tile.");
      await new Promise<void>(resolve => window.setTimeout(resolve, renderer.presentMillDeliveryLeg(path, building, carrying)));
      if (mounted.current) renderer.finishMillDeliveryLeg();
    };
    try {
      if (!farm.farm.production.delivery) {
        const pickup = (oven.type === "brewery" ? breweryOutputPlacement(oven) : roadsideOutputPlacement(oven, farm.farm.roads, Date.now())).pickup;
        if (!pickup) throw new Error("Connect the bread oven to a completed road before collecting bread.");
        await travel(pickup, oven, false);
        if (!mounted.current) return;
        farm = await executeGameCommand({ type: "production_delivery", action: "pickup", buildingId: id, expectedFarmVersion: current.current!.farm.version });
        accept.current(farm);
      }
      for (let stop = 0; stop < 2 && farm.farm.production.delivery; stop++) {
        const warehouse = farm.buildings.find(b => b.type === "warehouse" && Date.parse(b.completesAt) <= Date.now());
        const destination = physicalDeliveryStop(itemKey, farm.inventory.find(i => i.itemKey === itemKey), farm.buildings, Date.now(), porterStorageReservation(farm.farm.production.porter, itemKey));
        const building = destination.location === "warehouse" ? warehouse! : farmOrigin;
        const target = destination.location === "warehouse" ? warehouse!.loadingTile ?? { column: building.column, row: building.row + 2 } : INITIAL_FARM_CONFIG.farmerSpawn;
        await travel(target, building, true);
        if (!mounted.current) return;
        farm = await executeGameCommand({ type: "production_delivery", action: "store", buildingId: id, expectedFarmVersion: current.current!.farm.version });
        accept.current(farm);
      }
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "Could not store the goods.");
    } finally {
      submitting.current = false;
      if (mounted.current) { setPending(false); renderer.setPlantingSelection(null, false); refresh.current(); }
    }
  };
  const offerAtShrine = async (item: "bread" | "beer") => {
    const farm = current.current, renderer = scene.current;
    if (!farm || !renderer || !information || submitting.current) return;
    const shrine = buildingAt(farm, information.cell);
    if (!shrine || shrineOfferingBlocker(farm, shrine.id, item, Date.now())) return;
    const home = INITIAL_FARM_CONFIG.farmerSpawn;
    const toFarm = pickupPath(farm, renderer.farmerPosition(), home, Date.now());
    const toShrine = shrine.loadingTile && pickupPath(farm, home, shrine.loadingTile, Date.now());
    if (!toFarm || !toShrine) { setError("No clear path between the farm and shrine."); return; }
    submitting.current = true; setPending(true); setError(null);
    renderer.clearSelection(); renderer.setPlantingSelection(null, true);
    try {
      await new Promise<void>(resolve => window.setTimeout(resolve, renderer.presentMillDeliveryLeg(toFarm, farmOrigin, false)));
      if (!mounted.current) return;
      renderer.finishMillDeliveryLeg();
      await new Promise<void>(resolve => window.setTimeout(resolve, renderer.presentMillDeliveryLeg(toShrine, shrine, true, item === "beer", item === "bread")));
      if (!mounted.current) return;
      renderer.finishMillDeliveryLeg();
      const next = await executeGameCommand({ type: "shrine_offering", buildingId: shrine.id, item, expectedFarmVersion: current.current!.farm.version });
      if (mounted.current) accept.current(next);
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "Could not deliver the offering.");
    } finally {
      submitting.current = false;
      if (mounted.current) { renderer.finishMillDeliveryLeg(); renderer.setPlantingSelection(null, false); setPending(false); refresh.current(); }
    }
  };
  const breweryAction = async (action: BrewerySupplyAction) => {
    const farm = current.current, renderer = scene.current;
    if (!farm || !renderer || !information || submitting.current) return;
    const building = buildingAt(farm, information.cell);
    let target = building ?? information.cell;
    const pourFromFarmer = action === "pour_water" && information.kind === "farmer";
    if (pourFromFarmer) {
      const ground = waterPourTarget(farm, renderer.farmerPosition(), Date.now());
      if (!ground) return;
      target = ground;
    }
    if (action === "collect_water") target = { column: target.column, row: INITIAL_FARM_CONFIG.riverRow };
    if (!canSupplyBrewery(farm, target, action, Date.now())) return;
    submitting.current = true; setPending(true); setError(null);
    const farmerPosition = renderer.farmerPosition();
    renderer.clearSelection(); renderer.setPlantingSelection(null, true);
    try {
      // Starting production is immediate; only supply transfers wait for their walk.
      if (action === "stock_jars") {
        const home = INITIAL_FARM_CONFIG.farmerSpawn;
        const toFarm = pickupPath(farm, farmerPosition, home, Date.now());
        const toBrewery = building?.loadingTile && pickupPath(farm, home, building.loadingTile, Date.now());
        // Validate both legs before moving; inventory changes only on successful delivery.
        if (!toFarm || !toBrewery) throw new Error("No clear path between the farm and brewery.");
        await new Promise<void>(resolve => window.setTimeout(resolve, renderer.presentMillDeliveryLeg(toFarm, farmOrigin, false)));
        if (!mounted.current) return;
        renderer.finishMillDeliveryLeg();
        await new Promise<void>(resolve => window.setTimeout(resolve, renderer.presentMillDeliveryLeg(toBrewery, target, true, true)));
        if (!mounted.current) return;
        renderer.finishMillDeliveryLeg();
      } else if (action !== "start_brewing" && !pourFromFarmer) {
        const destination = action === "collect_water" || action === "pour_water" ? fishingApproach(farm, farmerPosition, target, Date.now())?.bank
          : building?.loadingTile ?? target;
        const path = destination && pickupPath(farm, farmerPosition, destination, Date.now());
        if (!path) throw new Error("No clear path to the loading point.");
        await new Promise<void>(resolve => window.setTimeout(resolve, renderer.presentMillDeliveryLeg(path, target, false)));
        if (!mounted.current) return;
        renderer.finishMillDeliveryLeg();
      }
      const next = await executeGameCommand({ type: "brewery_supply", action, target, farmerPosition, expectedFarmVersion: current.current!.farm.version });
      if (mounted.current) accept.current(next);
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "Could not supply the brewery.");
    } finally {
      if (mounted.current) renderer.finishMillDeliveryLeg();
      submitting.current = false;
      if (mounted.current) { setPending(false); renderer.setPlantingSelection(null, false); refresh.current(); }
    }
  };
  const startBaking = async () => {
    const farm = current.current, renderer = scene.current;
    if (!farm || !renderer || !information || submitting.current) return;
    const oven = buildingAt(farm, information.cell);
    if (!oven || !canBakeBread(farm, oven.id, Date.now())) return;
    submitting.current = true; setPending(true); setError(null);
    const farmerPosition = renderer.farmerPosition();
    renderer.clearSelection();
    try {
      const next = await executeGameCommand({ type: "start_baking", buildingId: oven.id, farmerPosition, expectedFarmVersion: farm.farm.version });
      if (mounted.current) accept.current(next);
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "Could not start baking.");
    } finally { submitting.current = false; if (mounted.current) { setPending(false); refresh.current(); } }
  };
  const startMill = async (recipe: MillRecipe, worker: MillWorker) => {
    const farm = current.current, renderer = scene.current;
    if (!farm || !renderer || !information || submitting.current) return;
    const mill = buildingAt(farm, information.cell);
    if (!mill || !millPopupState(farm, mill.id, Date.now(), recipe, worker).canStart) return;
    submitting.current = true; setPending(true); setError(null);
    renderer.setPlantingSelection(null, true);
    const farmerPosition = renderer.farmerPosition();
    const donkeyPosition = worker === "donkey" ? renderer.donkeyPosition() : undefined;
    renderer.clearSelection();
    try {
      const next = await executeGameCommand({ type: "start_milling", recipe, worker, target: { column: mill.column, row: mill.row }, farmerPosition, donkeyPosition,
        expectedFarmVersion: farm.farm.version });
      if (mounted.current) accept.current(next);
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "Could not start milling.");
    } finally { submitting.current = false; if (mounted.current) { setPending(false); renderer.setPlantingSelection(null, false); refresh.current(); } }
  };
  const stopDecoration = () => { scene.current?.setDecorationPlacement(null); setDecorationId(null); setDecorationTarget(null); setDecorationError(null); };
  const placeDecoration = (id:string) => {
    cancelBuilding(); updateSelection(null);
    setManageOpen(false);setInformation(null);setDecorationId(id);setDecorationTarget(null);setDecorationError(null);
    scene.current?.setDecorationPlacement(setDecorationTarget);
  };
  const changeDecoration = async (id:string, target?:IsoCell) => {
    if(submitting.current)return;submitting.current=true;setPending(true);setDecorationError(null);
    try { const next=await sendDecoration(target?{type:"place",rewardId:id,target}:{type:"store",rewardId:id});accept.current(next);stopDecoration();scene.current?.clearSelection();setInformation(null); }
    catch(cause){const message=cause instanceof Error?cause.message:"Could not update decoration.";setDecorationError(message);notificationStore.getState().notifyError(message);}
    finally{submitting.current=false;setPending(false);}
  };
  const beginBuilding = (type: PlaceableBuilding) => {
    stopDecoration();
    if (!current.current || submitting.current || buildingBuildBlocker(current.current, Date.now(), type)) return;
    setBuildingType(type);
    setManageOpen(false); setInformation(null); setBuildingTarget(null); setBuildingError(null); setPlacingBuilding(true);
    scene.current?.beginBuildingPlacement(type, cell => {
      setPlacementFarmer(scene.current?.farmerPosition() ?? farmOrigin);
      setBuildingTarget(cell);
    });
  };
  const cancelBuilding = () => {
    if (submitting.current) return;
    scene.current?.endBuildingPlacement(); setPlacingBuilding(false); setBuildingTarget(null); setBuildingError(null);
  };
  useEffect(() => {
    if (!placingBuilding) return;
    const cancel = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting.current) {
        scene.current?.endBuildingPlacement(); setPlacingBuilding(false); setBuildingTarget(null); setBuildingError(null);
      }
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, [placingBuilding]);
  const placement = snapshot && buildingTarget ? buildingPlacement(snapshot, buildingTarget, placementFarmer, clock, buildingType) : null;
  const buildReason = snapshot ? buildingBuildBlocker(snapshot, clock, buildingType) ?? (placement && placement.rule.type !== "valid" ? describeBuildingPlacementRule(placement.rule) : null) : null;
  const constructBuilding = async () => {
    const farm = current.current, renderer = scene.current;
    if (!farm || !renderer || !buildingTarget || submitting.current || buildingBuildBlocker(farm, Date.now(), buildingType)) return;
    const from = renderer.farmerPosition();
    const check = buildingPlacement(farm, buildingTarget, from, Date.now(), buildingType);
    if (check.rule.type !== "valid") return;
    submitting.current = true; setPending(true); setBuildingError(null);
    try {
      const next = await executeGameCommand({ type: constructionCommands[buildingType], target: buildingTarget, expectedFarmVersion: farm.farm.version });
      if (!mounted.current) return;
      const building = next.buildings.find(b => b.type === buildingType && sameCell(b, buildingTarget));
      renderer.endBuildingPlacement(); setPlacingBuilding(false); setBuildingTarget(null);
      if (building?.loadingTile) {
        const path = previewWalkPath(next, from, building.loadingTile, Date.now());
        if (path.length || sameCell(from, building.loadingTile)) renderer.presentConstructionApproach([from, ...path], Date.parse(building.completesAt));
      }
      accept.current(next);
    } catch (cause) {
      if (mounted.current) setBuildingError(cause instanceof Error ? cause.message : `Could not build the ${buildingType}.`);
    } finally { submitting.current = false; if (mounted.current) { setPending(false); refresh.current(); } }
  };
  const openManagement = (open: boolean) => {
    if (open) cancelBuilding();
    if (open) { scene.current?.clearSelection(); setInformation(null); }
    setManageOpen(open);
  };
  useEffect(() => {
    const openBuild = () => {
      if (location !== "farm") return;
      if (submitting.current) return;
      setRoadPlan(null); setRoadError(null);
      scene.current?.endBuildingPlacement(); setPlacingBuilding(false); setBuildingTarget(null); setBuildingError(null);
      scene.current?.clearSelection(); setInformation(null);
      setManageTab("build"); setManageOpen(true);
    };
    window.addEventListener(OPEN_BUILD_DRAWER, openBuild);
    return () => window.removeEventListener(OPEN_BUILD_DRAWER, openBuild);
  }, [location]);
  const updateSelection = (cells: readonly IsoCell[] | null) => {
    selecting.current = cells; setSelection(cells); scene.current?.setPlantingSelection(cells, submitting.current, selectionMode.current);
  };
  const beginSelection = (nextMode: "plant" | "harvest" | "sesame" | "harvestSesame", initial?: IsoCell) => {
    if (submitting.current) return;
    selectionMode.current = nextMode; setMode(nextMode); setError(null); scene.current?.clearSelection();
    updateSelection(initial ? [initial] : []);
  };
  useEffect(() => {
    mounted.current = true;
    levelUiStore.getState().setOpen(false);
    const controller = new AbortController();
    let game: Phaser.Game | undefined, requestPending = false, lastRead = 0;
    let stopLoadingMonitor: (() => void) | undefined;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const receive = (next: FarmSnapshot) => {
      if (controller.signal.aborted || !parent.current) return;
      if (current.current?.farm.id === next.farm.id && current.current.farm.version > next.farm.version) return;
      if (current.current?.farm.id === next.farm.id && newlyPurchasedDonkey(current.current.inventory, next.inventory) &&
        activeScene.current === marketScene.current && marketScene.current) {
        marketScene.current.showPurchasedDonkey();
      }
      current.current = next; setSnapshot(next);
      farmStore.getState().setReady(next);
      if (next.farm.production.planting && selecting.current !== null) {
        selecting.current = null; setSelection(null); scene.current?.setPlantingSelection(null, submitting.current);
      }
      if (scene.current) scene.current.setSnapshot(next);
      else {
        const renderer = new IsometricFarmScene(next, setInformation, cell => {
          const farm = current.current;
          if (!farm || selecting.current === null || submitting.current) return;
          const harvesting = selectionMode.current === "harvest" || selectionMode.current === "harvestSesame";
          const crop = selectionMode.current === "sesame" || selectionMode.current === "harvestSesame" ? "sesame" : "barley";
          const selected = togglePlantingField(selecting.current, cell, (harvesting ? harvestableFields(farm, Date.now(), crop) : plantableFields(farm, Date.now())), harvesting ? harvestingSelectionLimit(farm, Date.now(), crop) : plantingSelectionLimit(farm, Date.now(), selectionMode.current === "sesame" ? "sesame" : "barley"));
          selecting.current = selected; setSelection(selected); scene.current?.setPlantingSelection(selected, false, selectionMode.current);
        }, () => {
          activeScene.current = marketScene.current; setInformation(null); setLocation("market"); });
        const market = new IsometricMarketScene(anchor => {
          const scope = isometricTradeScope(anchor?.kind);
          if (scope && canOpenMarketStand(scope, current.current?.farm.progression?.level ?? 1)) {
            marketScene.current?.clearSelection();
            setInformation(null);
            marketUiStore.getState().openMarket(scope);
          } else setInformation(anchor);
        }, donkey => {
          marketUiStore.getState().setOpen(false);
          if (donkey) scene.current?.receiveMarketDonkey();
          activeScene.current = scene.current; setInformation(null); setLocation("farm"); refresh.current();
        }, () => current.current?.farm.progression?.level ?? 1);
        renderer.setFishingCastHandler(aim => void castFish(aim));
        renderer.setFishingStatusHandler(setFishingStatus);
        scene.current = renderer;
        marketScene.current = market; activeScene.current = renderer;
        const neighbourhood = new NeighbourhoodScene();
        neighbourhood.onZigguratClick = () => setZigguratOpen(true);
        neighbourhoodScene.current = neighbourhood;
        game = new Phaser.Game({ type: Phaser.AUTO, parent: parent.current, backgroundColor: "#f4e5c7", scene: [renderer, market, neighbourhood, BackgroundMusicScene],
          callbacks: { postBoot: readyGame => {
            if (!controller.signal.aborted) stopLoadingMonitor = monitorGameLoading(readyGame, [renderer, market, neighbourhood], setGameLoading);
          } },
          scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" }, input: { windowEvents: false }, render: { antialias: true } });
      }
      clearTimeout(deadline);
      const now = Date.now();
      const due = [...next.crops.map(crop => nextCropTransition(crop, now) ?? 0), ...[...Object.values(next.farm.production.baking).flatMap(job => [job.startedAt, job.completesAt]), next.farm.milling?.startedAt, next.farm.milling?.completesAt, next.farm.gathering?.completesAt, next.farm.production.planting?.nextStepAt, ...next.buildings.map(b => b.completesAt), ...next.improvements.filter(i => improvementWorkActive(i, now)).map(i => i.destroyCompletesAt ?? i.completesAt)]
        .concat(Object.values(next.farm.production.brewing ?? {}).flatMap(job => [job.arrivedAt, job.startedAt, job.completesAt]), next.buildings.map(b => b.beerReadyAt ?? undefined))
        .filter((value): value is string => !!value).map(Date.parse), ...next.farm.roads.map(r => r.completesAt ?? 0),
        next.farm.production.porter?.job?.pickupAt ?? 0, next.farm.production.porter?.job?.completesAt ?? 0,
        next.farm.production.porter?.returnTrip?.completesAt ?? 0,
        ...(next.farm.production.cropWorkQueue ?? []).flatMap(job => [job.workStartsAt, job.workEndsAt, job.completesAt]),
        next.farm.production.cropWork?.workStartsAt ?? 0, next.farm.production.cropWork?.workEndsAt ?? 0, next.farm.production.cropWork?.completesAt ?? 0].filter(time => time > now);
      if (due.length) deadline = setTimeout(() => refresh.current(), Math.max(100, Math.min(...due) - now + 25));
    };
    accept.current = receive;
    // Shared market commands publish snapshots here; reflect trades immediately
    // in the sleeping farm too, without waiting for the polling interval.
    const unsubscribe = farmStore.subscribe(({ farm }) => {
      if (farm.type === "ready" && current.current && farm.snapshot !== current.current && farm.snapshot.farm.id === current.current.farm.id) receive(farm.snapshot);
    });
    marketUiStore.getState().setOpen(false);
    const load = async () => {
      if (requestPending || submitting.current || document.visibilityState === "hidden") return;
      requestPending = true;
      const startedAt = performance.now();
      try {
        const next = await fetchDevelopmentFarm(controller.signal);
        renderDiagnostic("snapshot-fetch", startedAt);
        const applyStarted = performance.now();
        if (!submitting.current) receive(next);
        renderDiagnostic("snapshot-apply", applyStarted, { skipped: submitting.current });
        lastRead = Date.now();
      } catch { if (!controller.signal.aborted) {
        setError("Could not refresh the farm. Retry when connected.");
        if (!game) setGameLoading("error");
      } }
      finally { requestPending = false; }
    };
    refresh.current = () => { void load(); };
    const visible = () => { if (document.visibilityState === "visible") void load(); };
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setClock(Date.now());
      const porter = current.current?.farm.production.porter;
      if (porter && (porter.expiresAt > Date.now() || porter.job || porter.returnTrip) && Date.now() - lastRead >= 2000) void load();
      if (current.current?.farm.gathering || current.current?.farm.production.planting || current.current?.farm.roads.some(r => (r.completesAt ?? 0) > Date.now()) || current.current?.improvements.some(i => improvementWorkActive(i, Date.now())) || Date.now() - lastRead >= 30_000) void load();
    }, 1000);
    document.addEventListener("visibilitychange", visible);
    return () => { mounted.current = false; controller.abort(); stopLoadingMonitor?.(); unsubscribe(); levelUiStore.getState().setOpen(false); marketUiStore.getState().setOpen(false); clearTimeout(deadline); window.clearInterval(timer); document.removeEventListener("visibilitychange", visible); scene.current = null; marketScene.current = null; activeScene.current = null; game?.destroy(true); };
  }, []);

  const batch = snapshot?.farm.production.planting;
  const preparingBread = Object.values(snapshot?.farm.production.baking ?? {}).some(job => Date.parse(job.startedAt) > clock);
  const fishingActive = location === "farm" && !!snapshot?.farm.fishing;
  const cropWork = snapshot ? currentCropWork(snapshot.farm.production, clock) : null;
  const harvesting = batch ? batch.mode === "harvest" : mode === "harvest" || mode === "harvestSesame";
  const plantingCrop = batch ? batch.cropKey ?? "barley" : mode === "sesame" || mode === "harvestSesame" ? "sesame" : "barley";
  const blocker = snapshot ? (harvesting ? harvestingBlocker : plantingBlocker)(snapshot, clock) : "Loading…";
  const limit = snapshot ? harvesting ? batch ? lockedHarvestFieldLimit(batch) : harvestingSelectionLimit(snapshot, clock, plantingCrop) : plantingSelectionLimit(snapshot, clock, plantingCrop) : 0;
  const eligible = snapshot ? (harvesting ? harvestableFields(snapshot, clock, plantingCrop) : plantableFields(snapshot, clock)) : [];
  const selectionMaximum = harvesting ? harvestSelectionMaximum(limit, eligible.length) : limit;
  const valid = !!selection?.length && selection.length <= limit && selection.every(cell => eligible.some(p => fieldKey(p) === fieldKey(cell)));
  const submit = async () => {
    const farm = current.current;
    if (!farm || submitting.current) return;
    const job = farm.farm.production.planting;
    if (job || !valid || (harvesting ? harvestingBlocker : plantingBlocker)(farm, Date.now())) return;
    submitting.current = true; setPending(true); setError(null);
    scene.current?.setPlantingSelection(selecting.current, true, selectionMode.current);
    try {
      const next = await executeGameCommand({ ...(harvesting ? { type: "start_batch_harvesting" as const, crop: plantingCrop } : { type: "start_batch_planting" as const, crop: plantingCrop }), targets: [...selecting.current!], farmerPosition: scene.current?.farmerPosition(), expectedFarmVersion: farm.farm.version });
      if (!mounted.current) return;
      accept.current(next); updateSelection(null); setInformation(null);
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "Could not update the field job. Refresh before retrying.");
    } finally {
      submitting.current = false;
      if (mounted.current) { setPending(false); scene.current?.setPlantingSelection(selecting.current, false, selectionMode.current); refresh.current(); }
    }
  };
  const storeBarley = async () => {
    let farm = current.current;
    if (!farm || !information || submitting.current || transferBlocker(farm, Date.now())) return;
    submitting.current = true; setPending(true); setError(null);
    scene.current?.setPlantingSelection(null, true);
    try {
      for (let stop = 0; stop < 3 && farm.farm.carriedItem; stop++) {
        const from = scene.current?.farmerPosition() ?? information.cell;
        const material = materialStoragePlan(farm, from, Date.now());
        const { plan } = barleyStoragePlan(farm, from, Date.now());
        if (material) {
          const next = await executeGameCommand({ type: "deposit_carried_item", expectedFarmVersion: farm.farm.version });
          if (!mounted.current) return;
          const duration = scene.current?.presentStorageDelivery(material.path, farm, material.building) ?? 0;
          accept.current(next); scene.current?.clearSelection();
          if (duration) await new Promise<void>(resolve => window.setTimeout(resolve, duration));
          if (!mounted.current) return;
          farm = current.current!;
          continue;
        }
        if (stop > 0 && !plan) break;
        if (!plan) throw new Error("No reachable storage available.");
        const next = await executeGameCommand(plan.destination.type === "granary"
          ? { type: "deposit_carried_item_in_granary", target: plan.destination.target, expectedFarmVersion: farm.farm.version }
          : { type: "deposit_carried_item", expectedFarmVersion: farm.farm.version });
        if (!mounted.current) return;
        const duration = scene.current?.presentStorageDelivery(plan.path, farm, plan.destination.type === "granary" ? plan.destination.target : farmOrigin) ?? 0;
        accept.current(next); scene.current?.clearSelection();
        if (duration) await new Promise<void>(resolve => window.setTimeout(resolve, duration));
        if (!mounted.current) return;
        farm = current.current!;
      }
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "Could not store the goods. Refresh before retrying.");
    } finally {
      submitting.current = false;
      if (mounted.current) { setPending(false); scene.current?.setPlantingSelection(null, false); refresh.current(); }
    }
  };
  const transferFish = async (action: "store" | "release") => {
    const farm = current.current, renderer = scene.current;
    if (!farm || !renderer || submitting.current || farm.farm.carriedItem?.itemKey !== "fish") return;
    const release = action === "release" && information ? fishingApproach(farm, renderer.farmerPosition(), information.cell, Date.now()) : null;
    const target = action === "store" ? farmOrigin : release?.target;
    const path = action === "store" ? pickupPath(farm, renderer.farmerPosition(), INITIAL_FARM_CONFIG.farmerSpawn, Date.now()) : release?.path;
    if (!target || !path) { setError("No clear path."); return; }
    submitting.current = true; setPending(true); renderer.setPlantingSelection(null, true);
    try {
      const next = await executeGameCommand({ type: "fishing", action, target, expectedFarmVersion: farm.farm.version });
      if (!mounted.current) return;
      const duration = renderer.presentStorageDelivery(path, farm, target);
      accept.current(next); renderer.clearSelection();
      await new Promise<void>(resolve => window.setTimeout(resolve, duration));
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "Could not deliver the fish.");
    } finally {
      submitting.current = false;
      if (mounted.current) { setPending(false); renderer.setPlantingSelection(null, false); refresh.current(); }
    }
  };
  const fish = async (stop = false) => {
    const farm = current.current, renderer = scene.current;
    if (!farm || !renderer || submitting.current) return;
    const plan = !stop && information && canStartIsometricFishing(farm, information.cell, Date.now())
      ? fishingApproach(farm, renderer.farmerPosition(), information.cell, Date.now()) : null;
    if (!stop && !plan) { setError("No clear path to the riverbank."); return; }
    if (stop && !farm.farm.fishing) return;
    submitting.current = true; setPending(true); setError(null);
    setFishingMessage("");
    renderer.setPlantingSelection(null, true);
    try {
      const next = await executeGameCommand(stop
        ? { type: "cancel_fishing", sessionId: farm.farm.fishing!.id }
        : { type: "fishing", action: "start", target: plan!.target, expectedFarmVersion: farm.farm.version });
      if (!mounted.current) return;
      if (plan) renderer.presentFishingApproach(plan.path);
      accept.current(next); renderer.clearSelection();
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "Could not change fishing.");
    } finally {
      submitting.current = false;
      if (mounted.current) { setPending(false); renderer.setPlantingSelection(null, false); refresh.current(); }
    }
  };
  const gather = async (itemKey: "reed" | "clay") => {
    const farm = current.current, renderer = scene.current;
    if (!farm || !renderer || !information || submitting.current) return;
    const target = information.cell;
    if (isometricTilePopup(farm, target, Date.now()).actions.gather !== itemKey) return;
    const path = gatheringPath(farm, renderer.farmerPosition(), target, Date.now());
    if (!path) { setError("No clear path to this resource."); return; }
    submitting.current = true; setPending(true); setError(null);
    renderer.setPlantingSelection(null, true);
    try {
      const next = await executeGameCommand({ type: "start_gather_resource", itemKey, target, expectedFarmVersion: farm.farm.version });
      if (!mounted.current) return;
      renderer.presentGatheringApproach(path);
      accept.current(next); renderer.clearSelection();
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "Could not collect the material.");
    } finally {
      submitting.current = false;
      if (mounted.current) { setPending(false); renderer.setPlantingSelection(null, false); refresh.current(); }
    }
  };
  const tileAction = async (type: "pickup_ground_item" | "drop_carried_item" | "build_irrigation" | "destroy_irrigation" | "build_road" | "destroy_road" | "destroy_ground_material") => {
    const farm = current.current;
    if (!farm || !information || submitting.current) return;
    const target = information.cell;
    const action = isometricTilePopup(farm, target, Date.now());
    const allowed = { destroy_road: action.actions.destroyRoad, destroy_irrigation: action.actions.destroyIrrigation, destroy_ground_material: action.actions.destroyMaterial, pickup_ground_item: action.pickup && !action.pickupDisabled, drop_carried_item: action.drop && !action.dropDisabled, build_irrigation: action.irrigation && !action.irrigationDisabled, build_road: action.road && !action.roadDisabled };
    if (!allowed[type]) return;
    if (type === "destroy_road") {
      const reason = porterRoadRemovalReason(farm.farm.production.porter, target) ?? roadRemovalReason(target, farm.farm.roads, farm.buildings.flatMap(b => b.loadingTile ? [b.loadingTile] : []), Date.now());
      if (reason) { notificationStore.getState().notifyError(reason); return; }
    }
    const materialDrop = type === "drop_carried_item" &&
      (farm.farm.carriedItem?.itemKey === "reed" || farm.farm.carriedItem?.itemKey === "clay");
    if (materialDrop) notificationStore.getState().setMaterialDrop(farm.farm.id);
    submitting.current = true; setPending(true); setError(null);
    scene.current?.setPlantingSelection(null, true);
    try {
      const transfer = type === "pickup_ground_item" ? "pickup" : type === "drop_carried_item" ? "drop" : null;
      const path = transfer ? pickupPath(farm, scene.current?.farmerPosition() ?? target, target, Date.now()) : null;
      if (transfer && !path) throw new Error("No clear path to this tile.");
      const constructionWork = type === "build_irrigation" || type === "destroy_irrigation" || type === "destroy_road" || type === "build_road";
      const approach = constructionWork ? constructionApproachPath(farm, scene.current?.farmerPosition() ?? target, target, Date.now()) : null;
      if (constructionWork && !approach) throw new Error("No clear path to this construction site.");
      const next = await executeGameCommand(type === "destroy_ground_material"
        ? { type, groundItemId: action.groundItem!.id, expectedFarmVersion: farm.farm.version }
        : type === "destroy_road" || type === "build_road" ? { type, target, farmerPosition: scene.current?.farmerPosition(), expectedFarmVersion: farm.farm.version }
        : { type, target, expectedFarmVersion: farm.farm.version });
      if (!mounted.current) return;
      const item = (transfer === "drop" ? next : farm).groundItems.find(item => item.column === target.column && item.row === target.row);
      const canal = approach ? next.improvements.find(i => i.column === target.column && i.row === target.row) : undefined;
      const road = approach ? next.farm.roads.find(r => r.column === target.column && r.row === target.row) : undefined;
      const duration = approach && road?.completesAt ? scene.current?.presentConstructionApproach(road.approachPath ?? approach, road.completesAt) ?? 0 : approach && canal ? scene.current?.presentConstructionApproach(approach, Date.parse(canal.destroyCompletesAt ?? canal.completesAt)) ?? 0
        : transfer && path && item ? scene.current?.presentGroundTransfer(transfer, path, item, farm.farm.carriedItem?.quantity ?? 0) ?? 0 : 0;
      accept.current(next); scene.current?.clearSelection();
      // Only locks local controls. Never defer the server command to animation completion.
      if (duration) await new Promise<void>(resolve => window.setTimeout(resolve, duration));
    } catch (cause) {
      if (mounted.current) {
        const message = cause instanceof Error ? cause.message : "Could not complete the action. Refresh before retrying.";
        if (type === "destroy_road") notificationStore.getState().notifyError(message);
        else setError(message);
      }
    } finally {
      submitting.current = false;
      if (materialDrop && notificationStore.getState().materialDropFarmId === farm.farm.id) notificationStore.getState().setMaterialDrop(null);
      if (mounted.current) { setPending(false); scene.current?.setPlantingSelection(null, false); refresh.current(); }
    }
  };
  const openNeighbourhood = async () => {
    const farmId = current.current?.farm.id;
    if (!farmId || (current.current?.farm.progression?.level ?? 1) < 7) return;
    neighbourhoodRequest.current?.abort();
    const controller = new AbortController(); neighbourhoodRequest.current = controller;
    setNeighbourhoodLoad("loading");
    try {
      const data = await requestNeighbourhood(AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]));
      if (controller.signal.aborted || !mounted.current || current.current?.farm.id !== farmId) return;
      if (activeScene.current !== scene.current) { setNeighbourhoodLoad("idle"); return; }
      setManageOpen(false); setInformation(null); scene.current?.clearSelection();
      levelUiStore.getState().setOpen(false);
      neighbourhoodScene.current?.setMembers(data.members);
      setZigguratOpen(false);
      scene.current?.scene.switch("neighbourhood");
      activeScene.current = neighbourhoodScene.current; setNeighbourhoodOpen(true); setNeighbourhoodLoad("idle");
    } catch {
      if (!controller.signal.aborted && mounted.current && current.current?.farm.id === farmId) setNeighbourhoodLoad("error");
    }
  };
  const roadBlocked = snapshot && roadPlan?.length ? roadPlanBlocker(snapshot, roadPlan, clock) : null;
  return <section className={styles.test} aria-label="Saved isometric farm preview">
    <div className={styles.gameContent} inert={gameLoading !== "ready"} aria-busy={gameLoading !== "ready"}>
    {location === "farm" && !neighbourhoodOpen && <Dialog.Root open={manageOpen} onOpenChange={openManagement}>
      <div className={styles.manageControls}>
        <div className={styles.manageButtonRow}>
          <Tooltip.Provider delayDuration={300}>
            <Tooltip.Root {...navigationTooltip("manage")}>
              <Tooltip.Trigger asChild>
                <Dialog.Trigger asChild>
                  <button className={`${styles.manageButton} ${actionStyles.button} ${styles.manageIconButton}`} disabled={!snapshot || roadPlan !== null || decorationId !== null} aria-label="Manage"><BuildingActionIcon kind="manage" /></button>
                </Dialog.Trigger>
              </Tooltip.Trigger>
              <Tooltip.Portal><Tooltip.Content className={styles.navigationTooltip} side="bottom" sideOffset={6} collisionPadding={8}>Manage your estate<Tooltip.Arrow className={styles.navigationTooltipArrow} /></Tooltip.Content></Tooltip.Portal>
            </Tooltip.Root>
            {(snapshot?.farm.progression?.level ?? 1) >= 7 && <Tooltip.Root {...navigationTooltip("neighbourhood")}>
              <Tooltip.Trigger asChild>
                <button className={`${styles.manageButton} ${actionStyles.button} ${styles.manageIconButton}`} disabled={pending || decorationId !== null || placingBuilding || selection !== null || roadPlan !== null || neighbourhoodLoad === "loading"} aria-label="Neighbourhood" onClick={() => void openNeighbourhood()}><BuildingActionIcon kind="neighbourhood" /></button>
              </Tooltip.Trigger>
              <Tooltip.Portal><Tooltip.Content className={styles.navigationTooltip} side="bottom" sideOffset={6} collisionPadding={8}>View your neighbourhood<Tooltip.Arrow className={styles.navigationTooltipArrow} /></Tooltip.Content></Tooltip.Portal>
            </Tooltip.Root>}
            <Tooltip.Root {...navigationTooltip("roads")}>
              <Tooltip.Trigger asChild>
                <button className={`${styles.manageButton} ${actionStyles.button} ${styles.manageIconButton}`}
                  disabled={!snapshot || pending || decorationId !== null || roadBuilding || placingBuilding || selection !== null} aria-label="Build roads" aria-pressed={roadPlan !== null}
                  onClick={() => { setRoadPlan(roadPlan === null ? [] : null); setRoadError(null); setManageOpen(false); setInformation(null); }}>
                  <BuildingActionIcon kind="road" />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal><Tooltip.Content className={styles.navigationTooltip} side="bottom" sideOffset={6}>Build roads<Tooltip.Arrow className={styles.navigationTooltipArrow} /></Tooltip.Content></Tooltip.Portal>
            </Tooltip.Root>
            <SettingsDrawer onOpen={() => { setManageOpen(false); scene.current?.clearSelection(); setInformation(null); }} />
          </Tooltip.Provider>
        </div>
        {neighbourhoodLoad === "loading" && <small role="status">Loading neighbours…</small>}
        {neighbourhoodLoad === "error" && <small role="alert">Could not load neighbours.<br />Press Neighbourhood to retry.</small>}
        {snapshot && <div className={styles.resourceBalanceRow}>
          <ShekelBalance amount={snapshot.player.shekelBalance} />
          <BarleyBalance amount={storedPlantingBarley(snapshot, clock)} />
        </div>}
      </div>
      <EstateManagementContent farmState={snapshot ? { type: "ready", snapshot } : { type: "loading" }}
        marketRoad={marketEntrance}
        storageClock={clock} manageTab={manageTab} setManageTab={setManageTab}
        buildContent={snapshot && <IsometricBuildingCatalogue snapshot={snapshot} now={clock} onBuild={beginBuilding} />}
        decorationsContent={snapshot && <><DecorationsPanel snapshot={snapshot} pending={pending} onPlace={placeDecoration} onStore={id=>void changeDecoration(id)}/>
          {decorationError&&<p role="alert">{decorationError}</p>}</>} />
    </Dialog.Root>}
    {location === "market" && !neighbourhoodOpen && <div className={styles.manageControls}>
      <div className={styles.manageButtonRow}>
        <Tooltip.Provider delayDuration={300}>
          <SettingsDrawer onOpen={() => {
            marketScene.current?.clearSelection();
            setInformation(null);
            marketUiStore.getState().setOpen(false);
          }} />
        </Tooltip.Provider>
      </div>
    </div>}
    {neighbourhoodOpen && <div className={styles.manageControls}>
      <div className={styles.manageButtonRow}>
        <Tooltip.Provider delayDuration={300}>
          <Tooltip.Root {...navigationTooltip("leaderboard")}>
            <Tooltip.Trigger asChild>
              <button className={`${styles.manageButton} ${actionStyles.button} ${styles.manageIconButton}`} aria-label="Leaderboard" aria-haspopup="dialog" onClick={() => setNeighbourhoodLeaderboardOpen(true)}><BuildingActionIcon kind="leaderboard" /></button>
            </Tooltip.Trigger>
            <Tooltip.Portal><Tooltip.Content className={styles.navigationTooltip} side="bottom" sideOffset={6} collisionPadding={8}>View the leaderboard<Tooltip.Arrow className={styles.navigationTooltipArrow} /></Tooltip.Content></Tooltip.Portal>
          </Tooltip.Root>
          <Tooltip.Root {...navigationTooltip("return")}>
            <Tooltip.Trigger asChild>
              <button className={`${styles.manageButton} ${actionStyles.button} ${styles.manageIconButton}`} aria-label="Back to your farm" onClick={() => {
                setDeliveryPreview(false); neighbourhoodScene.current?.previewDelivery(false);
                setNeighbourhoodLeaderboardOpen(false);
                neighbourhoodScene.current?.scene.switch("isometric-farm");
                activeScene.current = scene.current; setNeighbourhoodOpen(false); refresh.current();
              }}><BuildingActionIcon kind="farm" /></button>
            </Tooltip.Trigger>
            <Tooltip.Portal><Tooltip.Content className={styles.navigationTooltip} side="bottom" sideOffset={6} collisionPadding={8}>Back to your farm<Tooltip.Arrow className={styles.navigationTooltipArrow} /></Tooltip.Content></Tooltip.Portal>
          </Tooltip.Root>
          <SettingsDrawer onOpen={() => {
            setNeighbourhoodLeaderboardOpen(false);
            setInformation(null);
          }} />
        </Tooltip.Provider>
      </div>
    </div>}
    <div className={styles.toolbar}>
      {neighbourhoodOpen ? <strong>Neighbourhood</strong> : location === "market" ? <span>Market{snapshot ? ` · Level ${snapshot.farm.progression?.level ?? 1}` : ""}</span>
        : <button disabled={!snapshot || pending || roadPlan !== null} aria-haspopup="dialog" onClick={() => {
          cancelBuilding(); scene.current?.clearSelection(); setInformation(null);
          levelUiStore.getState().setOpen(true);
        }}>Farm level {snapshot?.farm.progression?.level ?? 1}</button>}
      <button onClick={() => activeScene.current?.zoomBy(1.2)} aria-label="Zoom in">+</button>
      <button onClick={() => activeScene.current?.zoomBy(1 / 1.2)} aria-label="Zoom out">−</button>
      <button onClick={() => activeScene.current?.fit()}>Fit</button>

      {!neighbourhoodOpen && location === "farm" && <>
        <button onClick={() => { scene.current?.previewBarleyHarvest(true); setHarvestPreview(true); }}>Preview barley harvest</button>
        {harvestPreview && <button onClick={() => { scene.current?.previewBarleyHarvest(false); setHarvestPreview(false); }}>Stop harvest preview</button>}
      </>}
      {neighbourhoodOpen && <button aria-pressed={deliveryPreview} onClick={()=>{
        const next=!deliveryPreview;setDeliveryPreview(next);neighbourhoodScene.current?.previewDelivery(next);
      }}>{deliveryPreview ? "Stop delivery preview" : "Preview ziggurat delivery"}</button>}
    </div>
    <div ref={parent} className={styles.canvas} />
    {neighbourhoodOpen && (snapshot?.farm.progression?.level ?? 1) >= 7 &&
      <NeighbourhoodLeaderboardDialog open={neighbourhoodLeaderboardOpen} onOpenChange={setNeighbourhoodLeaderboardOpen} />}
    {neighbourhoodOpen && snapshot && <ZigguratDialog key={snapshot.farm.id} farmId={snapshot.farm.id} open={zigguratOpen} onOpenChange={setZigguratOpen} onState={updateZiggurat} />}
    <MarketDialog />
    <FarmLevelDialog onLevelClaimed={(farmId, level) => {
      const renderer = scene.current;
      if (!mounted.current || !renderer || activeScene.current !== renderer || current.current?.farm.id !== farmId) return;
      levelUiStore.getState().setOpen(false);
      renderer.celebrateLevel(level);
    }} />
    {decorationId && snapshot && <aside className={styles.planting} aria-label="Place miniature ziggurat">
      <p>Choose a free ground tile for your miniature ziggurat.</p>
      {(decorationError || (decorationTarget && miniaturePlacementError(snapshot,decorationTarget))) && <p role="alert">{decorationError ?? miniaturePlacementError(snapshot,decorationTarget!)}</p>}
      <button className={actionStyles.button} disabled={pending || !decorationTarget || !!miniaturePlacementError(snapshot,decorationTarget)} onClick={()=>decorationTarget&&void changeDecoration(decorationId,decorationTarget)}><BuildingActionIcon kind="confirm" /><span>Place decoration</span></button>
      <button className={actionStyles.button} disabled={pending} onClick={stopDecoration}><BuildingActionIcon kind="cancel" /><span>Cancel</span></button>
    </aside>}
    {placingBuilding && <aside className={styles.planting} aria-label={`${buildingType} placement`}>
      <p role="status">{buildingError ?? buildReason ?? (buildingTarget ? constructionSummary(buildingType) : `Choose a location for the ${constructionNames[buildingType]}`)}</p>
      <div>
        {buildingTarget && !buildReason && <button disabled={pending} onClick={() => void constructBuilding()}>{pending ? "Building…" : `Build ${constructionNames[buildingType]}`}</button>}
        {buildingTarget && <button disabled={pending} onClick={() => beginBuilding(buildingType)}>Choose another location</button>}
        <button disabled={pending} onClick={cancelBuilding}>Cancel</button>
      </div>
    </aside>}
    {demolitionId && snapshot && <DestroyBuildingDialog key={demolitionId} snapshot={snapshot} buildingId={demolitionId} now={clock}
      onClose={() => setDemolitionId(null)} onDestroyed={next => accept.current(next)} />}
    {!neighbourhoodOpen && location === "farm" && palmTarget && snapshot &&
      <PalmPlantingConfirmation key={`${palmTarget.column}:${palmTarget.row}`} snapshot={snapshot} target={palmTarget} now={clock}
        getFarmerPosition={() => { const p = scene.current?.farmerPosition(); return p && { column: Math.round(p.column), row: Math.round(p.row) }; }}
        onCancel={() => setPalmTarget(null)}
        onStarted={next => { accept.current(next); setPalmTarget(null); scene.current?.clearSelection(); setInformation(null); }} />}
    {!neighbourhoodOpen && location === "farm" && cropWork?.action === "harvest" &&
      !cropWork.settled && clock < cropWork.completesAt &&
      <aside className={styles.planting} aria-label={cropWork.cropKey === "sesame" ? "Sesame harvesting" : "Date harvesting"}>
        <PalmHarvestProgress job={cropWork} now={clock} />
      </aside>}
    {!neighbourhoodOpen && location === "farm" && snapshot?.farm.production.cropWork &&
      (snapshot.farm.production.cropWork.action === "plant" || snapshot.farm.production.cropWork.action === "tend") &&
      !snapshot.farm.production.cropWork.settled && clock < snapshot.farm.production.cropWork.completesAt &&
      <aside className={styles.planting} aria-label={snapshot.farm.production.cropWork.cropKey === "sesame" ? "Sesame planting" : snapshot.farm.production.cropWork.action === "tend" ? "Date palm tending" : "Date palm planting"}>
        <PalmPlantingProgress job={snapshot.farm.production.cropWork} now={clock} />
      </aside>}
    {!neighbourhoodOpen && (selection !== null || batch || error || fishingActive || preparingBread) && <aside className={styles.planting} aria-label={preparingBread ? "Preparing bread" : fishingActive ? "Fishing" : harvesting ? `${plantingCrop === "sesame" ? "Sesame" : "Barley"} harvesting` : `${plantingCrop === "sesame" ? "Sesame" : "Barley"} planting`}>
      {preparingBread ? <p role="status">Collecting flour for baking…</p> : fishingActive ? <p role="status">{fishingMessage && `${fishingMessage} `}{fishingStatus}</p>
        : batch && snapshot ? <BarleyWorkProgress crop={plantingCrop} action={harvesting ? "Harvesting" : "Sowing"} total={batch.total}
        progress={harvesting ? harvestingProgress(snapshot, clock) : sowingProgress(batch, clock)} delivering={batch.phase.type === "delivering"} />
        : <p role="status">{selection !== null ? `${selection.length} / ${selectionMaximum} fields${harvesting ? snapshot ? plantingCrop === "sesame" ? ` · Space for ${availableSesameHarvestStorage(snapshot, clock)} sesame baskets` : ` · Space for ${availableBarleyHarvestStorage(snapshot, clock)} barley` : "" : ` · ${snapshot ? availablePlantingSeeds(snapshot, clock, plantingCrop) : 0} ${plantingCrop} available`}` : ""}</p>}
      {error && <p role="alert">{error}</p>}
      {fishingActive ? <button disabled={pending} onClick={() => void fish(true)}>Stop fishing</button>
        : !batch && !preparingBread && <div>
        {selection !== null && <button disabled={pending || !valid || !!blocker} onClick={() => void submit()}>
          {pending ? "Please wait…" : harvesting ? `Harvest ${plantingCrop}` : `Plant ${plantingCrop}`}
        </button>}
        <button disabled={pending} onClick={() => { updateSelection(null); setError(null); }}>Cancel</button>
      </div>}
    </aside>}
    {!decorationId && !neighbourhoodOpen && information && snapshot && selection === null && !error && !pending && (information.kind === "market" || information.kind === "farmReturn" || information.kind === "barleyMarket" || information.kind === "beerMarket" || information.kind === "bakingMarket" || information.kind === "produceMarket"
      ? <IsometricTravelPopup anchor={information} available={information.kind === "farmReturn" || canVisitIsometricMarket(snapshot, clock)}
        onClose={() => activeScene.current?.clearSelection()} onTravel={() => {
          if (information.kind === "farmReturn") marketScene.current?.goBackToFarm();
          else if (!scene.current?.goToMarket()) setError("Cannot reach the market right now.");
        }} />
      : <IsometricTilePopup onStoreDecoration={id => void changeDecoration(id)} snapshot={snapshot} anchor={information} now={clock}
        onRequestPalm={() => { setPalmTarget(information.cell); scene.current?.clearSelection(); setInformation(null); setError(null); }}
        getFarmerPosition={() => { const position = scene.current?.farmerPosition(); return position && { column: Math.round(position.column), row: Math.round(position.row) }; }}
      onClaimLevel={() => {
        setPending(true);
        void claimFarmLevel().then(next => {
          if (!mounted.current || !next || current.current?.farm.id !== next.farm.id) return;
          scene.current?.clearSelection(); setInformation(null);
          if (activeScene.current === scene.current) scene.current?.celebrateLevel(next.farm.progression!.level);
        }).catch(cause => {
          if (mounted.current) setError(cause instanceof Error ? cause.message : "The level could not be claimed.");
        }).finally(() => { if (mounted.current) setPending(false); });
      }}
      onDestroyBuilding={id => { scene.current?.clearSelection(); setInformation(null); setDemolitionId(id); }}
      onStore={() => void storeBarley()}
      onGather={itemKey => void gather(itemKey)}
      onMill={(recipe, worker) => void startMill(recipe, worker)}
      onBake={() => void startBaking()}
      onBreweryAction={action => void breweryAction(action)}
      onStoreBread={id => void storeBread(id)}
      onOffer={item => void offerAtShrine(item)}
      onPickupMill={id => void collectMillBags(id)}
      onFish={() => void fish()}
      onFishTransfer={action => void transferFish(action)}
      onPickup={() => void tileAction("pickup_ground_item")}
      onDestroyMaterial={() => void tileAction("destroy_ground_material")}
      onClose={() => scene.current?.clearSelection()} onSelect={beginSelection} onWalk={() => scene.current?.walkTo(information.cell)} onDrop={() => void tileAction("drop_carried_item")} onBuildIrrigation={() => void tileAction("build_irrigation")} onDestroyIrrigation={() => void tileAction("destroy_irrigation")} onDestroyRoad={() => void tileAction("destroy_road")} />)}
    {roadPlan !== null && snapshot && <section className={styles.planting} aria-label="Road plan">
      {roadBuilding ? <p role="status">Building roads…</p> : <>
      <p>{roadPlan.length ? `${roadPlan.length} road ${roadPlan.length === 1 ? "tile" : "tiles"} selected` : "Select adjoining tiles, starting beside a road."}</p>
      {(roadError || roadBlocked || plantingBlocker(snapshot, clock) || snapshot.farm.carriedItem) && <InfoAlert>
        {roadError ?? roadBlocked ?? plantingBlocker(snapshot, clock) ?? "Empty your hands first."}
      </InfoAlert>}
      <div>
        <button disabled={pending || !roadPlan.length || !!roadBlocked} onClick={() => void submitRoadPlan()}>Build road</button>
        <button disabled={pending} onClick={() => { setRoadPlan(null); setRoadError(null); }}>Dismiss</button>
      </div>
      </>}
    </section>}
    {!neighbourhoodOpen && !(location === "farm" && snapshot?.farm.fishing) && <p className={styles.status}>{selection !== null ? "Tap yellow fields to select · Green fields are selected" : "Tap a tile for actions · Drag to pan"}</p>}
    {(snapshot?.farm.progression?.level ?? 1) >= 7 && <MerchantRequests visual />}
    </div>
    {gameLoading !== "ready" && <GameLoadingScreen state={gameLoading} retry={() => window.location.reload()} />}
  </section>;
}
