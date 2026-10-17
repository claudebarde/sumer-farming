import { useEffect, useRef, useState } from "react";
import { SHADOW_PRESETS, type ShadowPreset } from "../game/phaser/daylightShadows";
import Phaser from "phaser";
import { roadRemovalReason } from "../../game-core/farm/roads";
import type { FarmSnapshot } from "../../schemas/farm";
import { fetchDevelopmentFarm } from "../api/developmentPlayer";
import { executeGameCommand } from "../api/gameActions";
import { availablePlantingBarley, plantableFields, harvestableFields, plantingSelectionLimit, togglePlantingField, fieldKey } from "../../game-core/farm/batchPlanting";
import { harvestFieldLimit, lockedHarvestFieldLimit } from "../../game-core/farm/harvestCapacity";
import type { IsoCell } from "../game/phaser/isometricProjection";
import { plantingBlocker } from "../game/phaser/isometricPlanting";
import { harvestingBlocker, harvestSelectionMaximum } from "../game/phaser/isometricHarvesting";
import { isometricTilePopup } from "../game/phaser/isometricTilePopup";
import { improvementWorkActive } from "../../game-data/farmImprovements";
import { pickupPath } from "../game/phaser/isometricPickup";
import { constructionApproachPath } from "../game/phaser/isometricConstruction";
import { barleyStoragePlan } from "../game/phaser/isometricStorage";
import { farmOrigin } from "../game/phaser/isometricFarm";
import { IsometricFarmScene, type IsometricTileAnchor } from "../game/phaser/scenes/IsometricFarmScene";
import IsometricTilePopup from "./IsometricTilePopup";
import IsometricTravelPopup from "./IsometricTravelPopup";
import { IsometricMarketScene } from "../game/phaser/scenes/IsometricMarketScene";
import { canVisitIsometricMarket, isometricTradeScope } from "../game/phaser/isometricMarket";
import styles from "../styles/IsometricTest.module.scss";
import MarketDialog from "./MarketDialog";
import FarmLevelDialog from "./FarmLevelDialog";
import { constructionCommands, constructionNames, constructionSummary } from "../game/phaser/isometricBuildingPlacement";
import { claimFarmLevel } from "../api/claimFarmLevel";
import BarleyWorkProgress from "./BarleyWorkProgress";
import { sowingProgress } from "../game/phaser/isometricPlanting";
import { harvestingProgress } from "../game/phaser/isometricHarvesting";
import { levelUiStore } from "../stores/levelUiStore";
import { farmStore } from "../stores/farmStore";
import { notificationStore } from "../stores/notificationStore";
import { marketUiStore } from "../stores/marketUiStore";
import { canOpenMarketStand } from "../../game-data/progression";
import { Dialog } from "radix-ui";
import EstateManagementContent from "./EstateManagementContent";
import IsometricBuildingCatalogue from "./IsometricBuildingCatalogue";
import DestroyBuildingDialog from "./DestroyBuildingDialog";
import { buildingBuildBlocker, buildingPlacement, type PlaceableBuilding } from "../game/phaser/isometricBuildingPlacement";
import type { MillRecipe } from "../../game-data/milling";
import { roadsideOutputPlacement } from "../game/phaser/buildingOutputPlacement";
import { canBakeBread, canStoreBread } from "../game/phaser/isometricBaking";
import { breweryOutputPlacement, canSupplyBrewery, waterPourTarget } from "../game/phaser/isometricBrewing";
import type { BrewerySupplyAction } from "../../game-core/farm/brewerySupplies";
import { sharedDeliveryStop } from "../../game-core/farm/storageDelivery";
import { porterReserved } from "../../game-data/porter";
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

export default function IsometricFarm() {
  const parent = useRef<HTMLDivElement>(null);
  const scene = useRef<IsometricFarmScene | null>(null);
  const marketScene = useRef<IsometricMarketScene | null>(null);
  const activeScene = useRef<IsometricFarmScene | IsometricMarketScene | null>(null);
  const [location, setLocation] = useState<"farm" | "market">("farm");
  const [shadowPreset, setShadowPreset] = useState<ShadowPreset>("local");
  const shadowPresetRef = useRef<ShadowPreset>("local");
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
  const selectionMode = useRef<"plant" | "harvest">("plant");
  const [mode, setMode] = useState<"plant" | "harvest">("plant");
  const submitting = useRef(false);
  const mounted = useRef(false);
  const [snapshot, setSnapshot] = useState<FarmSnapshot | null>(null);
  const [selection, setSelection] = useState<readonly IsoCell[] | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fishingMessage, setFishingMessage] = useState("");
  const [fishingStatus, setFishingStatus] = useState("Getting ready…");
  const [information, setInformation] = useState<IsometricTileAnchor | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [placementFarmer, setPlacementFarmer] = useState<IsoCell>(farmOrigin);
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
        const destination = sharedDeliveryStop(itemKey, (farm.inventory.find(i => i.itemKey === itemKey)?.quantity ?? 0) + porterReserved(farm.farm.production.porter, itemKey), !!warehouse);
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
  const startMill = async (recipe: MillRecipe) => {
    const farm = current.current, renderer = scene.current;
    if (!farm || !renderer || !information || submitting.current) return;
    const mill = buildingAt(farm, information.cell);
    if (!mill || !millPopupState(farm, mill.id, Date.now(), recipe).canStart) return;
    submitting.current = true; setPending(true); setError(null);
    const farmerPosition = renderer.farmerPosition();
    renderer.clearSelection();
    try {
      const next = await executeGameCommand({ type: "start_milling", recipe, worker: "farmer", target: { column: mill.column, row: mill.row }, farmerPosition,
        expectedFarmVersion: farm.farm.version });
      if (mounted.current) accept.current(next);
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "Could not start milling.");
    } finally { submitting.current = false; if (mounted.current) { setPending(false); refresh.current(); } }
  };
  const beginBuilding = (type: PlaceableBuilding) => {
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
  const beginSelection = (nextMode: "plant" | "harvest", initial?: IsoCell) => {
    if (submitting.current) return;
    selectionMode.current = nextMode; setMode(nextMode); setError(null); scene.current?.clearSelection();
    updateSelection(initial ? [initial] : []);
  };
  useEffect(() => {
    mounted.current = true;
    levelUiStore.getState().setOpen(false);
    const controller = new AbortController();
    let game: Phaser.Game | undefined, requestPending = false, lastRead = 0;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const receive = (next: FarmSnapshot) => {
      if (controller.signal.aborted || !parent.current) return;
      if (current.current?.farm.id === next.farm.id && current.current.farm.version > next.farm.version) return;
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
          const harvesting = selectionMode.current === "harvest";
          const selected = togglePlantingField(selecting.current, cell, (harvesting ? harvestableFields : plantableFields)(farm, Date.now()), harvesting ? harvestFieldLimit(farm.farm.household.happiness) : plantingSelectionLimit(farm, Date.now()));
          selecting.current = selected; setSelection(selected); scene.current?.setPlantingSelection(selected, false, selectionMode.current);
        }, () => { activeScene.current = marketScene.current; setInformation(null); setLocation("market"); });
        const market = new IsometricMarketScene(anchor => {
          const scope = isometricTradeScope(anchor?.kind);
          if (scope && canOpenMarketStand(scope, current.current?.farm.progression?.level ?? 1)) {
            marketScene.current?.clearSelection();
            setInformation(null);
            marketUiStore.getState().openMarket(scope);
          } else setInformation(anchor);
        }, () => {
          marketUiStore.getState().setOpen(false);
          activeScene.current = scene.current; setInformation(null); setLocation("farm"); refresh.current();
        }, () => current.current?.farm.progression?.level ?? 1);
        renderer.setFishingCastHandler(aim => void castFish(aim));
        renderer.setFishingStatusHandler(setFishingStatus);
        scene.current = renderer;
        renderer.shadowPreset = shadowPresetRef.current;
        market.shadowPreset = shadowPresetRef.current;
        marketScene.current = market; activeScene.current = renderer;
        game = new Phaser.Game({ type: Phaser.AUTO, parent: parent.current, backgroundColor: "#f4e5c7", scene: [renderer, market],
          scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" }, input: { windowEvents: false }, render: { antialias: true } });
      }
      clearTimeout(deadline);
      const now = Date.now();
      const due = [...[...Object.values(next.farm.production.baking).flatMap(job => [job.startedAt, job.completesAt]), next.farm.milling?.startedAt, next.farm.milling?.completesAt, next.farm.gathering?.completesAt, next.farm.production.planting?.nextStepAt, ...next.buildings.map(b => b.completesAt), ...next.improvements.filter(i => improvementWorkActive(i, now)).map(i => i.destroyCompletesAt ?? i.completesAt)]
        .concat(Object.values(next.farm.production.brewing ?? {}).flatMap(job => [job.arrivedAt, job.startedAt, job.completesAt]), next.buildings.map(b => b.beerReadyAt ?? undefined))
        .filter((value): value is string => !!value).map(Date.parse), ...next.farm.roads.map(r => r.completesAt ?? 0)].filter(time => time > now);
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
      try {
        const next = await fetchDevelopmentFarm(controller.signal);
        if (!submitting.current) receive(next);
        lastRead = Date.now();
      } catch { if (!controller.signal.aborted) setError("Could not refresh the farm. Retry when connected."); }
      finally { requestPending = false; }
    };
    refresh.current = () => { void load(); };
    const visible = () => { if (document.visibilityState === "visible") void load(); };
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setClock(Date.now());
      if (current.current?.farm.gathering || current.current?.farm.production.planting || current.current?.farm.roads.some(r => (r.completesAt ?? 0) > Date.now()) || current.current?.improvements.some(i => improvementWorkActive(i, Date.now())) || Date.now() - lastRead >= 30_000) void load();
    }, 1000);
    document.addEventListener("visibilitychange", visible);
    return () => { mounted.current = false; controller.abort(); unsubscribe(); levelUiStore.getState().setOpen(false); marketUiStore.getState().setOpen(false); clearTimeout(deadline); window.clearInterval(timer); document.removeEventListener("visibilitychange", visible); scene.current = null; marketScene.current = null; activeScene.current = null; game?.destroy(true); };
  }, []);

  const batch = snapshot?.farm.production.planting;
  const preparingBread = Object.values(snapshot?.farm.production.baking ?? {}).some(job => Date.parse(job.startedAt) > clock);
  const fishingActive = location === "farm" && !!snapshot?.farm.fishing;
  const harvesting = batch ? batch.mode === "harvest" : mode === "harvest";
  const blocker = snapshot ? (harvesting ? harvestingBlocker : plantingBlocker)(snapshot, clock) : "Loading…";
  const limit = snapshot ? harvesting ? batch ? lockedHarvestFieldLimit(batch) : harvestFieldLimit(snapshot.farm.household.happiness) : plantingSelectionLimit(snapshot, clock) : 0;
  const eligible = snapshot ? (harvesting ? harvestableFields : plantableFields)(snapshot, clock) : [];
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
      const next = await executeGameCommand({ type: harvesting ? "start_batch_harvesting" : "start_batch_planting", targets: [...selecting.current!], farmerPosition: scene.current?.farmerPosition(), expectedFarmVersion: farm.farm.version });
      if (!mounted.current) return;
      accept.current(next); updateSelection(null); setInformation(null);
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "Could not update the field job. Refresh before retrying.");
    } finally {
      submitting.current = false;
      if (mounted.current) { setPending(false); scene.current?.setPlantingSelection(selecting.current, false, selectionMode.current); refresh.current(); }
    }
  };
  const storeBarley = async (granaryId?: string) => {
    const farm = current.current;
    if (!farm || !information || submitting.current || plantingBlocker(farm, Date.now())) return;
    submitting.current = true; setPending(true); setError(null);
    scene.current?.setPlantingSelection(null, true);
    try {
      const { plan } = barleyStoragePlan(farm, scene.current?.farmerPosition() ?? information.cell, Date.now(), granaryId);
      if (!plan) throw new Error("No reachable storage available.");
      const next = await executeGameCommand(plan.destination.type === "granary"
        ? { type: "deposit_carried_item_in_granary", target: plan.destination.target, expectedFarmVersion: farm.farm.version }
        : { type: "deposit_carried_item", expectedFarmVersion: farm.farm.version });
      if (!mounted.current) return;
      const duration = scene.current?.presentStorageDelivery(plan.path, farm, plan.destination.type === "granary" ? plan.destination.target : farmOrigin) ?? 0;
      accept.current(next); scene.current?.clearSelection();
      if (duration) await new Promise<void>(resolve => window.setTimeout(resolve, duration));
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "Could not store the barley. Refresh before retrying.");
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
      const reason = roadRemovalReason(target, farm.farm.roads, farm.buildings.flatMap(b => b.loadingTile ? [b.loadingTile] : []), Date.now());
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
  return <section className={styles.test} aria-label="Saved isometric farm preview">
    {location === "farm" && <Dialog.Root open={manageOpen} onOpenChange={openManagement}>
      <Dialog.Trigger asChild>
        <button className={styles.manageButton} disabled={!snapshot}>Manage</button>
      </Dialog.Trigger>
      <EstateManagementContent farmState={snapshot ? { type: "ready", snapshot } : { type: "loading" }}
        storageClock={clock} manageTab={manageTab} setManageTab={setManageTab}
        buildContent={snapshot && <IsometricBuildingCatalogue snapshot={snapshot} now={clock} onBuild={beginBuilding} />} />
    </Dialog.Root>}
    <div className={styles.toolbar}>
      {location === "market" ? <span>Market{snapshot ? ` · Level ${snapshot.farm.progression?.level ?? 1}` : ""}</span>
        : <button disabled={!snapshot || pending} aria-haspopup="dialog" onClick={() => {
          cancelBuilding(); scene.current?.clearSelection(); setInformation(null);
          levelUiStore.getState().setOpen(true);
        }}>Farm level {snapshot?.farm.progression?.level ?? 1}</button>}
      <button onClick={() => activeScene.current?.zoomBy(1.2)} aria-label="Zoom in">+</button>
      <button onClick={() => activeScene.current?.zoomBy(1 / 1.2)} aria-label="Zoom out">−</button>
      <button onClick={() => activeScene.current?.fit()}>Fit</button>
      <label>Shadows <select aria-label="Shadow time preview" value={shadowPreset} onChange={event => {
        const preset = SHADOW_PRESETS.find(value => value === event.target.value) ?? "local";
        setShadowPreset(preset); shadowPresetRef.current = preset;
        if (scene.current) scene.current.shadowPreset = preset;
        if (marketScene.current) marketScene.current.shadowPreset = preset;
      }}>
        <option value="local">Local time</option>
        <option value="morning">Morning · 09:00</option>
        <option value="midday">Midday · 14:00</option>
        <option value="evening">Evening · 19:00</option>
        <option value="night">Night · 22:00</option>
      </select></label>
    </div>
    <div ref={parent} className={styles.canvas} />
    <MarketDialog />
    <FarmLevelDialog onLevelClaimed={(farmId, level) => {
      const renderer = scene.current;
      if (!mounted.current || !renderer || activeScene.current !== renderer || current.current?.farm.id !== farmId) return;
      levelUiStore.getState().setOpen(false);
      renderer.celebrateLevel(level);
    }} />
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
    {(selection !== null || batch || error || fishingActive || preparingBread) && <aside className={styles.planting} aria-label={preparingBread ? "Preparing bread" : fishingActive ? "Fishing" : harvesting ? "Barley harvesting" : "Barley planting"}>
      {preparingBread ? <p role="status">Collecting flour for baking…</p> : fishingActive ? <p role="status">{fishingMessage && `${fishingMessage} `}{fishingStatus}</p>
        : batch && snapshot ? <BarleyWorkProgress action={harvesting ? "Harvesting" : "Sowing"} total={batch.total}
        progress={harvesting ? harvestingProgress(snapshot, clock) : sowingProgress(batch, clock)} delivering={batch.phase.type === "delivering"} />
        : <p role="status">{selection !== null ? `${selection.length} / ${selectionMaximum} fields${harvesting ? "" : ` · ${snapshot ? availablePlantingBarley(snapshot, clock) : 0} barley available`}` : ""}</p>}
      {error && <p role="alert">{error}</p>}
      {fishingActive ? <button disabled={pending} onClick={() => void fish(true)}>Stop fishing</button>
        : !batch && !preparingBread && <div>
        {selection !== null && <button disabled={pending || !valid || !!blocker} onClick={() => void submit()}>
          {pending ? "Please wait…" : harvesting ? "Harvest barley" : "Plant barley"}
        </button>}
        <button disabled={pending} onClick={() => { updateSelection(null); setError(null); }}>Cancel</button>
      </div>}
    </aside>}
    {information && snapshot && selection === null && !error && !pending && (information.kind === "market" || information.kind === "farmReturn" || information.kind === "barleyMarket" || information.kind === "beerMarket" || information.kind === "bakingMarket"
      ? <IsometricTravelPopup anchor={information} available={information.kind === "farmReturn" || canVisitIsometricMarket(snapshot, clock)}
        onClose={() => activeScene.current?.clearSelection()} onTravel={() => {
          if (information.kind === "farmReturn") marketScene.current?.goBackToFarm();
          else if (!scene.current?.goToMarket()) setError("Cannot reach the market right now.");
        }} />
      : <IsometricTilePopup snapshot={snapshot} anchor={information} now={clock}
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
      onStore={granaryId => void storeBarley(granaryId)}
      onGather={itemKey => void gather(itemKey)}
      onMill={recipe => void startMill(recipe)}
      onBake={() => void startBaking()}
      onBreweryAction={action => void breweryAction(action)}
      onStoreBread={id => void storeBread(id)}
      onPickupMill={id => void collectMillBags(id)}
      onFish={() => void fish()}
      onFishTransfer={action => void transferFish(action)}
      onPickup={() => void tileAction("pickup_ground_item")}
      onDestroyMaterial={() => void tileAction("destroy_ground_material")}
      onClose={() => scene.current?.clearSelection()} onSelect={beginSelection} onWalk={() => scene.current?.walkTo(information.cell)} onDrop={() => void tileAction("drop_carried_item")} onBuildIrrigation={() => void tileAction("build_irrigation")} onDestroyIrrigation={() => void tileAction("destroy_irrigation")} onBuildRoad={() => void tileAction("build_road")} onDestroyRoad={() => void tileAction("destroy_road")} />)}
    {!(location === "farm" && snapshot?.farm.fishing) && <p className={styles.status}>{selection !== null ? "Tap yellow fields to select · Green fields are selected" : "Tap a tile for actions · Drag to pan"}</p>}
  </section>;
}
