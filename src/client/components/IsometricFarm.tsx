import { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import type { FarmSnapshot } from "../../schemas/farm";
import { fetchDevelopmentFarm } from "../api/developmentPlayer";
import { executeGameCommand } from "../api/gameActions";
import { availablePlantingBarley, plantableFields, harvestableFields, plantingSelectionLimit, togglePlantingField, fieldKey } from "../../game-core/farm/batchPlanting";
import { harvestFieldLimit, lockedHarvestFieldLimit } from "../../game-core/farm/harvestCapacity";
import type { IsoCell } from "../game/phaser/isometricProjection";
import { plantingBlocker } from "../game/phaser/isometricPlanting";
import { harvestingBlocker } from "../game/phaser/isometricHarvesting";
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
import SowingProgress from "./SowingProgress";
import { levelUiStore } from "../stores/levelUiStore";
import { farmStore } from "../stores/farmStore";
import { marketUiStore } from "../stores/marketUiStore";
import { canOpenMarketStand } from "../../game-data/progression";
import { Dialog } from "radix-ui";
import EstateManagementContent from "./EstateManagementContent";
import IsometricBuildingCatalogue from "./IsometricBuildingCatalogue";
import DestroyBuildingDialog from "./DestroyBuildingDialog";
import { granaryBuildBlocker, granaryPlacement } from "../game/phaser/isometricBuildingPlacement";
import { describeBuildingPlacementRule } from "../../game-core/farm/buildings";
import { previewWalkPath } from "../game/phaser/isometricWalking";
import { sameCell } from "../game/phaser/isometricFarm";
import { OPEN_BUILD_DRAWER } from "../api/buildingReadiness";
import { gatheringPath } from "../game/phaser/isometricGathering";

export default function IsometricFarm() {
  const parent = useRef<HTMLDivElement>(null);
  const scene = useRef<IsometricFarmScene | null>(null);
  const marketScene = useRef<IsometricMarketScene | null>(null);
  const activeScene = useRef<IsometricFarmScene | IsometricMarketScene | null>(null);
  const [location, setLocation] = useState<"farm" | "market">("farm");
  useEffect(() => {
    marketUiStore.getState().setLocation(location);
    levelUiStore.getState().setOpen(false);
  }, [location]);
  const [manageOpen, setManageOpen] = useState(false);
  const [manageTab, setManageTab] = useState("build");
  const [demolitionId, setDemolitionId] = useState<string | null>(null);
  const [placingGranary, setPlacingGranary] = useState(false);
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
  const [information, setInformation] = useState<IsometricTileAnchor | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [placementFarmer, setPlacementFarmer] = useState<IsoCell>(farmOrigin);
  const beginGranary = () => {
    if (!current.current || submitting.current || granaryBuildBlocker(current.current, Date.now())) return;
    setManageOpen(false); setInformation(null); setBuildingTarget(null); setBuildingError(null); setPlacingGranary(true);
    scene.current?.beginGranaryPlacement(cell => {
      setPlacementFarmer(scene.current?.farmerPosition() ?? farmOrigin);
      setBuildingTarget(cell);
    });
  };
  const cancelGranary = () => {
    if (submitting.current) return;
    scene.current?.endGranaryPlacement(); setPlacingGranary(false); setBuildingTarget(null); setBuildingError(null);
  };
  useEffect(() => {
    if (!placingGranary) return;
    const cancel = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting.current) {
        scene.current?.endGranaryPlacement(); setPlacingGranary(false); setBuildingTarget(null); setBuildingError(null);
      }
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, [placingGranary]);
  const placement = snapshot && buildingTarget ? granaryPlacement(snapshot, buildingTarget, placementFarmer, clock) : null;
  const buildReason = snapshot ? granaryBuildBlocker(snapshot, clock) ?? (placement && placement.rule.type !== "valid" ? describeBuildingPlacementRule(placement.rule) : null) : null;
  const constructGranary = async () => {
    const farm = current.current, renderer = scene.current;
    if (!farm || !renderer || !buildingTarget || submitting.current || granaryBuildBlocker(farm, Date.now())) return;
    const from = renderer.farmerPosition();
    const check = granaryPlacement(farm, buildingTarget, from, Date.now());
    if (check.rule.type !== "valid") return;
    submitting.current = true; setPending(true); setBuildingError(null);
    try {
      const next = await executeGameCommand({ type: "build_granary", target: buildingTarget, expectedFarmVersion: farm.farm.version });
      if (!mounted.current) return;
      const building = next.buildings.find(b => b.type === "granary" && sameCell(b, buildingTarget));
      renderer.endGranaryPlacement(); setPlacingGranary(false); setBuildingTarget(null);
      if (building?.loadingTile) {
        const path = previewWalkPath(next, from, building.loadingTile, Date.now());
        if (path.length || sameCell(from, building.loadingTile)) renderer.presentConstructionApproach([from, ...path], Date.parse(building.completesAt));
      }
      accept.current(next);
    } catch (cause) {
      if (mounted.current) setBuildingError(cause instanceof Error ? cause.message : "Could not build the granary.");
    } finally { submitting.current = false; if (mounted.current) { setPending(false); refresh.current(); } }
  };
  const openManagement = (open: boolean) => {
    if (open) cancelGranary();
    if (open) { scene.current?.clearSelection(); setInformation(null); }
    setManageOpen(open);
  };
  useEffect(() => {
    const openBuild = () => {
      if (location !== "farm") return;
      if (submitting.current) return;
      scene.current?.endGranaryPlacement(); setPlacingGranary(false); setBuildingTarget(null); setBuildingError(null);
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
        scene.current = renderer;
        marketScene.current = market; activeScene.current = renderer;
        game = new Phaser.Game({ type: Phaser.AUTO, parent: parent.current, backgroundColor: "#f4e5c7", scene: [renderer, market],
          scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" }, input: { windowEvents: false }, render: { antialias: true } });
      }
      clearTimeout(deadline);
      const now = Date.now();
      const due = [...[next.farm.gathering?.completesAt, next.farm.production.planting?.nextStepAt, ...next.buildings.map(b => b.completesAt), ...next.improvements.filter(i => improvementWorkActive(i, now)).map(i => i.destroyCompletesAt ?? i.completesAt)]
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
  const harvesting = batch ? batch.mode === "harvest" : mode === "harvest";
  const blocker = snapshot ? (harvesting ? harvestingBlocker : plantingBlocker)(snapshot, clock) : "Loading…";
  const limit = snapshot ? harvesting ? batch ? lockedHarvestFieldLimit(batch) : harvestFieldLimit(snapshot.farm.household.happiness) : plantingSelectionLimit(snapshot, clock) : 0;
  const eligible = snapshot ? (harvesting ? harvestableFields : plantableFields)(snapshot, clock) : [];
  const valid = !!selection?.length && selection.length <= limit && selection.every(cell => eligible.some(p => fieldKey(p) === fieldKey(cell)));
  const submit = async () => {
    const farm = current.current;
    if (!farm || submitting.current) return;
    const job = farm.farm.production.planting;
    if (job?.phase.type === "delivering" || (!job && (!valid || (harvesting ? harvestingBlocker : plantingBlocker)(farm, Date.now())))) return;
    submitting.current = true; setPending(true); setError(null);
    scene.current?.setPlantingSelection(selecting.current, true, selectionMode.current);
    try {
      const next = await executeGameCommand(job ? { type: "advance_batch_planting", action: "stop", batchId: job.id, expectedFarmVersion: farm.farm.version }
        : { type: harvesting ? "start_batch_harvesting" : "start_batch_planting", targets: [...selecting.current!], farmerPosition: scene.current?.farmerPosition(), expectedFarmVersion: farm.farm.version });
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
  const tileAction = async (type: "pickup_ground_item" | "drop_carried_item" | "build_irrigation" | "build_road") => {
    const farm = current.current;
    if (!farm || !information || submitting.current) return;
    const target = information.cell;
    const action = isometricTilePopup(farm, target, Date.now());
    const allowed = { pickup_ground_item: action.pickup && !action.pickupDisabled, drop_carried_item: action.drop && !action.dropDisabled, build_irrigation: action.irrigation && !action.irrigationDisabled, build_road: action.road && !action.roadDisabled };
    if (!allowed[type]) return;
    submitting.current = true; setPending(true); setError(null);
    scene.current?.setPlantingSelection(null, true);
    try {
      const transfer = type === "pickup_ground_item" ? "pickup" : type === "drop_carried_item" ? "drop" : null;
      const path = transfer ? pickupPath(farm, scene.current?.farmerPosition() ?? target, target, Date.now()) : null;
      if (transfer && !path) throw new Error("No clear path to this tile.");
      const approach = type === "build_irrigation" ? constructionApproachPath(farm, scene.current?.farmerPosition() ?? target, target, Date.now()) : null;
      if (type === "build_irrigation" && !approach) throw new Error("No clear path to this construction site.");
      const next = await executeGameCommand({ type, target, expectedFarmVersion: farm.farm.version });
      if (!mounted.current) return;
      const item = (transfer === "drop" ? next : farm).groundItems.find(item => item.column === target.column && item.row === target.row);
      const canal = approach ? next.improvements.find(i => i.column === target.column && i.row === target.row) : undefined;
      const duration = approach && canal ? scene.current?.presentConstructionApproach(approach, Date.parse(canal.completesAt)) ?? 0
        : transfer && path && item ? scene.current?.presentGroundTransfer(transfer, path, item, farm.farm.carriedItem?.quantity ?? 0) ?? 0 : 0;
      accept.current(next); scene.current?.clearSelection();
      // Only locks local controls. Never defer the server command to animation completion.
      if (duration) await new Promise<void>(resolve => window.setTimeout(resolve, duration));
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "Could not complete the action. Refresh before retrying.");
    } finally {
      submitting.current = false;
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
        buildContent={snapshot && <IsometricBuildingCatalogue snapshot={snapshot} now={clock} onBuildGranary={beginGranary} />} />
    </Dialog.Root>}
    <div className={styles.toolbar}>
      {location === "market" ? <span>Market{snapshot ? ` · Level ${snapshot.farm.progression?.level ?? 1}` : ""}</span>
        : <button disabled={!snapshot || pending} aria-haspopup="dialog" onClick={() => {
          cancelGranary(); scene.current?.clearSelection(); setInformation(null);
          levelUiStore.getState().setOpen(true);
        }}>Farm level {snapshot?.farm.progression?.level ?? 1}</button>}
      <button onClick={() => activeScene.current?.zoomBy(1.2)} aria-label="Zoom in">+</button>
      <button onClick={() => activeScene.current?.zoomBy(1 / 1.2)} aria-label="Zoom out">−</button>
      <button onClick={() => activeScene.current?.fit()}>Fit</button>
      {location === "farm" && <button disabled={!snapshot} onClick={() => scene.current?.previewProcession()}>Test procession</button>}
    </div>
    <div ref={parent} className={styles.canvas} />
    <MarketDialog />
    <FarmLevelDialog />
    {placingGranary && <aside className={styles.planting} aria-label="Granary placement">
      <p role="status">{buildingError ?? buildReason ?? (buildingTarget ? "Build granary · 2 reed · 3 clay · 2 minutes" : "Choose a location for the granary")}</p>
      <div>
        {buildingTarget && !buildReason && <button disabled={pending} onClick={() => void constructGranary()}>{pending ? "Building…" : "Build granary"}</button>}
        {buildingTarget && <button disabled={pending} onClick={beginGranary}>Choose another location</button>}
        <button disabled={pending} onClick={cancelGranary}>Cancel</button>
      </div>
    </aside>}
    {demolitionId && snapshot && <DestroyBuildingDialog key={demolitionId} snapshot={snapshot} buildingId={demolitionId} now={clock}
      onClose={() => setDemolitionId(null)} onDestroyed={next => accept.current(next)} />}
    {(selection !== null || batch || error) && <aside className={styles.planting} aria-label={harvesting ? "Barley harvesting" : "Barley planting"}>
      {batch && !harvesting ? <SowingProgress batch={batch} now={clock} /> : <p role="status">{batch ? batch.phase.type === "delivering" ? "Storing barley…" : batch.stopRequested ? "Stopping after this field…" : batch.phase.type === "collecting" ? "Collecting barley seeds…" : `Harvesting ${Math.min(batch.total, batch.total - batch.remaining.length + (batch.phase.type === "ready" ? 1 : 0))} / ${batch.total} fields`
        : selection !== null ? `${selection.length} / ${limit} fields${harvesting ? "" : ` · ${snapshot ? availablePlantingBarley(snapshot, clock) : 0} barley available`}` : ""}</p>}
      {error && <p role="alert">{error}</p>}
      {(!batch || harvesting) && <div>
        {(selection !== null || batch) && <button disabled={pending || (batch ? batch.stopRequested || batch.phase.type === "delivering" : !valid || !!blocker)} onClick={() => void submit()}>
          {pending ? "Please wait…" : batch ? batch.phase.type === "delivering" ? "Delivering barley…" : "Stop after this field" : harvesting ? "Harvest barley" : "Plant barley"}
        </button>}
        {!batch && <button disabled={pending} onClick={() => { updateSelection(null); setError(null); }}>Cancel</button>}
      </div>}
    </aside>}
    {information && snapshot && selection === null && !error && !pending && (information.kind === "market" || information.kind === "farmReturn" || information.kind === "barleyMarket" || information.kind === "beerMarket" || information.kind === "bakingMarket"
      ? <IsometricTravelPopup anchor={information} available={information.kind === "farmReturn" || canVisitIsometricMarket(snapshot, clock)}
        onClose={() => activeScene.current?.clearSelection()} onTravel={() => {
          if (information.kind === "farmReturn") marketScene.current?.goBackToFarm();
          else if (!scene.current?.goToMarket()) setError("Cannot reach the market right now.");
        }} />
      : <IsometricTilePopup snapshot={snapshot} anchor={information} now={clock}
      onDestroyBuilding={id => { scene.current?.clearSelection(); setInformation(null); setDemolitionId(id); }}
      onStore={granaryId => void storeBarley(granaryId)}
      onGather={itemKey => void gather(itemKey)}
      onPickup={() => void tileAction("pickup_ground_item")}
      onClose={() => scene.current?.clearSelection()} onSelect={beginSelection} onWalk={() => scene.current?.walkTo(information.cell)} onDrop={() => void tileAction("drop_carried_item")} onBuildIrrigation={() => void tileAction("build_irrigation")} onBuildRoad={() => void tileAction("build_road")} />)}
    <p className={styles.status}>{selection !== null ? "Tap yellow fields to select · Green fields are selected" : "Tap a tile for actions · Drag to pan"}</p>
  </section>;
}
