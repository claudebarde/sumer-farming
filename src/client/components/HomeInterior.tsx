import Header from "./Header";
import { Cross2Icon } from "@radix-ui/react-icons";
import { interiorSleepPhase } from "../game/home/interiorSleep";
import type { InteriorPoint } from "../game/home/interiorNavigation";
import KitchenDrawer from "./KitchenDrawer";
import HomeFurnitureCatalogue from "./HomeFurnitureCatalogue";
import CookingProgress from "./CookingProgress";
import { executeGameCommand } from "../api/gameActions";
import type { MealKey } from "../../game-data/kitchen";
import { replaceFurniture, removeFurniture } from "../../game-core/home/furnitureSurfaces";
import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, Tooltip } from "radix-ui";
import type { HomeInteriorScene } from "../game/home/HomeInteriorScene";
import GameTopBar from "./GameTopBar";
import GameLoadingScreen from "./GameLoadingScreen";
import SettingsDrawer from "./SettingsDrawer";
import RulesLink from "./RulesLink";
import BuildingActionIcon from "./BuildingActionIcon";
import { useNavigationTooltip } from "./useNavigationTooltip";
import bar from "../styles/IsometricTest.module.scss";
import actions from "../styles/BuildingActionButton.module.scss";
import type { FarmSnapshot } from "../../schemas/farm";
import { canRotateFurniture, furnitureDefinition, type FurnitureKey, type FurniturePlacement } from "../../game-data/homeFurniture";
import { FURNITURE_ARTWORK } from "../game/home/furnitureArtwork";
import type { FurniturePreview } from "../game/home/HomeInteriorScene";
import { sendHomeFurniture } from "../api/homeAppearance";
import { interiorAudioStore } from "../stores/interiorAudioStore";
import drawerStyles from "../styles/GameCanvas.module.scss";
import kitchen from "../styles/Kitchen.module.scss";
import styles from "../styles/HomeInterior.module.scss";

/** Independent visual interior. Visiting does not alter farm jobs or resources. */
export default function HomeInterior({ onClose, snapshot, clock, onSaved, visit }: {
  readonly visit?: { readonly playerId: string; readonly name: string; readonly appearance: import("../../schemas/playerHome").PlayerHome["appearance"] };
  readonly onClose: () => void; readonly snapshot: FarmSnapshot; readonly clock: number; readonly onSaved: (snapshot: FarmSnapshot) => void;
}) {
  const appearance = useMemo(() => visit ? { ...snapshot.farm.homeAppearance, ...visit.appearance } : snapshot.farm.homeAppearance, [snapshot.farm.homeAppearance, visit]);
  const visiting = useRef(!!visit);
  useEffect(() => {
    interiorAudioStore.setState({ active: true, walking: false });
    return () => { interiorAudioStore.setState({ active: false, walking: false }); };
  }, []);
  const tooltip = useNavigationTooltip();
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const scene = useRef<HomeInteriorScene | null>(null);
  const interiorContent = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const sleepPhase = interiorSleepPhase(snapshot.farm.sleep, clock, !!visit);
  const sleepRef = useRef(sleepPhase);
  const [wakeTarget, setWakeTarget] = useState<InteriorPoint | null>(null);
  const [waking, setWaking] = useState(false);
  const wakingRef = useRef(false);
  useEffect(() => { sleepRef.current = sleepPhase; scene.current?.setSleepPhase(sleepPhase); }, [sleepPhase]);
  const [furnishOpen, setFurnishOpen] = useState(false);
  const [kitchenOpen, setKitchenOpen] = useState(false);
  const [startingMeal, setStartingMeal] = useState(false);
  const mealPending = useRef(false);
  const cookingJob = !visit && snapshot.farm.production.cooking?.interior ? snapshot.farm.production.cooking : null;
  const jobRef = useRef(cookingJob);
  useEffect(() => { jobRef.current = cookingJob; scene.current?.setCookingJob(cookingJob); }, [cookingJob]);
  const cook = async (meal: MealKey) => {
    if (visit || mealPending.current || !scene.current) return;
    mealPending.current = true; setStartingMeal(true); setError(null);
    scene.current.lockFurniture(true);
    try {
      const next = await executeGameCommand({ type: "cook_meal", meal, buildingId: snapshot.farm.id,
        interiorPosition: scene.current.farmerPosition(), expectedFarmVersion: snapshot.farm.version });
      scene.current.setCookingJob(next.farm.production.cooking ?? null);
      onSaved(next); setKitchenOpen(false); setSelected(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not start cooking."); }
    finally { mealPending.current = false; setStartingMeal(false); scene.current?.lockFurniture(false); }
  };
  const [placing, setPlacing] = useState<FurnitureKey | null>(null);
  const [selected, setSelected] = useState<FurnitureKey | null>(null);
  const [preview, setPreview] = useState<FurniturePreview | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const appearanceRef = useRef(appearance);
  useEffect(() => { appearanceRef.current = appearance; scene.current?.setFurniture(appearance.furniture ?? []); scene.current?.setWallTablet(appearance.wallTablet ?? "none"); }, [appearance]);
  const cancelPlacement = () => { scene.current?.cancelPlacement(); setPlacing(null); setError(null); };
  const choose = (key: FurnitureKey) => {
    if (visit || cookingJob) return;
    setFurnishOpen(false); setSelected(null); setError(null); setPlacing(key);
    scene.current?.lockFurniture(false); scene.current?.beginPlacement(key);
  };
  const save = async (items: readonly FurniturePlacement[]) => {
    if (visit || savingRef.current || mealPending.current) return;
    savingRef.current = true; setSaving(true); setError(null); scene.current?.lockFurniture(true);
    try {
      const next = await sendHomeFurniture(appearanceRef.current.furnitureRevision ?? 0, items);
      appearanceRef.current = next.farm.homeAppearance;
      scene.current?.setFurniture(next.farm.homeAppearance.furniture ?? []);
      onSaved(next); cancelPlacement(); setSelected(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save your furniture."); }
    finally { savingRef.current = false; setSaving(false); scene.current?.lockFurniture(false); }
  };
  const confirmWake = async () => {
    if (!wakeTarget || wakingRef.current || visit) return;
    wakingRef.current = true; setWaking(true); setError(null);
    try {
      const next = await executeGameCommand({ type: "farmer_sleep", action: "wake", expectedFarmVersion: snapshot.farm.version });
      onSaved(next); scene.current?.setSleepPhase("awake"); scene.current?.walkTo(wakeTarget); setWakeTarget(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not wake the farmer."); }
    finally { wakingRef.current = false; setWaking(false); }
  };
  const exitRequested = useRef(false);
  const leave = () => {
    if (exitRequested.current || savingRef.current || mealPending.current || wakingRef.current) return;
    setWakeTarget(null);
    cancelPlacement(); setSelected(null);
    exitRequested.current = true;
    setLeaving(true);
    if (loading || failed || !scene.current) { onClose(); return; }
    scene.current.leave(onClose);
  };
  useEffect(() => {
    let disposed = false;
    let game: import("phaser").Game | undefined;
    let observer: ResizeObserver | undefined;
    void Promise.all([import("phaser"), import("../game/home/HomeInteriorScene")]).then(([{ default: Phaser }, { HomeInteriorScene }]) => {
      if (disposed || !host) return;
      const interior = new HomeInteriorScene(() => { if (!disposed) { interior.setCookingJob(jobRef.current); interior.setSleepPhase(sleepRef.current); setLoading(false); } }, setPreview, key => {
        if (!visiting.current) { if (key === "indoor-kitchen") setKitchenOpen(true); else setSelected(key); setError(null); }
      }, setWakeTarget);
      interior.setFurniture(appearanceRef.current.furniture ?? []);
      interior.setWallTablet(appearanceRef.current.wallTablet ?? "none");
      scene.current = interior;
      game = new Phaser.Game({
        type: Phaser.AUTO, parent: host, width: host.clientWidth, height: host.clientHeight,
        transparent: true, scene: interior, audio: { noAudio: true },
        render: { antialias: true, pixelArt: false },
      });
      observer = new ResizeObserver(() => {
        if (host.clientWidth && host.clientHeight) game?.scale.resize(host.clientWidth, host.clientHeight);
      });
      observer.observe(host);
    }).catch(error => {
      console.error("Unable to initialize home interior", error);
      if (!disposed) setFailed(true);
    });
    return () => { disposed = true; observer?.disconnect(); game?.destroy(true); scene.current = null; };
  }, [host]);
  return <Dialog.Root open onOpenChange={open => { if (!open) leave(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className={styles.overlay} />
      <Dialog.Content ref={interiorContent} tabIndex={-1} className={styles.scene} aria-describedby={undefined}
        onOpenAutoFocus={event => { event.preventDefault(); interiorContent.current?.focus({ preventScroll: true }); }}
        onCloseAutoFocus={event => event.preventDefault()}
        onEscapeKeyDown={event => { if (wakeTarget) { event.preventDefault(); if (!waking) { setWakeTarget(null); setError(null); } return; } if (saving || placing || selected) { event.preventDefault(); if (!saving) { cancelPlacement(); setSelected(null); } } }}>
        <Header />
        <Dialog.Title className={styles.accessibleTitle}>{visit ? `${visit.name}’s home` : "Your home"}</Dialog.Title>
        <GameTopBar snapshot={snapshot} clock={clock} zoomDisabled={loading}
          onZoomIn={() => scene.current?.zoomBy(1.2)} onZoomOut={() => scene.current?.zoomBy(1 / 1.2)} onFit={() => scene.current?.fit()}>
          <div className={bar.manageControls}><div className={bar.manageButtonRow}>
            <Tooltip.Provider delayDuration={300}>
              {!visit && <Tooltip.Root {...tooltip("furniture")}>
                <Tooltip.Trigger asChild>
                  <button className={`${bar.manageButton} ${actions.button} ${bar.manageIconButton}`} disabled={loading || leaving || saving || !!cookingJob || startingMeal || sleepPhase !== "awake"}
                    aria-label="Furniture" onClick={() => { cancelPlacement(); setSelected(null); scene.current?.lockFurniture(true); setFurnishOpen(true); }}>
                    <img className={styles.furnitureIcon} src={FURNITURE_ARTWORK["wooden-stool"]} alt="" />
                    <span className={bar.controlLabel}>Furniture</span>
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Portal><Tooltip.Content className={bar.navigationTooltip} side="bottom" sideOffset={6}>Furnish your home<Tooltip.Arrow className={bar.navigationTooltipArrow} /></Tooltip.Content></Tooltip.Portal>
              </Tooltip.Root>}
              <Tooltip.Root {...tooltip("home-return")}>
                <Tooltip.Trigger asChild>
                  <button className={`${bar.manageButton} ${actions.button} ${bar.manageIconButton} ${bar.travelButton}`} disabled={leaving || saving} aria-label={visit ? "Back to profile" : "Back to your farm"} onClick={leave}>
                    <BuildingActionIcon kind="farm" /><span className={bar.controlLabel}>{visit ? "Back" : "Your farm"}</span>
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Portal><Tooltip.Content className={bar.navigationTooltip} side="bottom" sideOffset={6}>{leaving ? "Leaving home…" : visit ? "Back to profile" : "Back to your farm"}<Tooltip.Arrow className={bar.navigationTooltipArrow} /></Tooltip.Content></Tooltip.Portal>
              </Tooltip.Root>
              <SettingsDrawer layer={1400} onOpen={() => { if (!saving) { cancelPlacement(); setSelected(null); } }} />
              <RulesLink toolbar />

            </Tooltip.Provider>
          </div></div>
        </GameTopBar>
        {visit && <p className={styles.visitTitle}>{visit.name}’s home</p>}
        <div className={styles.viewport} ref={setHost} role="region" aria-label="Home interior. Click the floor to walk.">
          {(loading || failed) && <GameLoadingScreen destination="home" homeOwnerName={visit && visit.playerId !== snapshot.farm.playerId ? visit.name : undefined} state={failed ? "error" : "loading"} retry={() => window.location.reload()} />}
        </div>
        {wakeTarget && <aside className={bar.planting}>
          <p>Wake the farmer?</p>
          {error && <p role="alert">{error}</p>}
          <div><button disabled={waking} onClick={() => void confirmWake()}>Confirm</button>
          <button disabled={waking} onClick={() => { setWakeTarget(null); setError(null); }}>Cancel</button></div>
        </aside>}
        {cookingJob && <aside className={bar.planting} aria-label="Cooking"><CookingProgress job={cookingJob} now={clock} /></aside>}
        {kitchenOpen && <KitchenDrawer snapshot={snapshot} now={clock}
          layer={1400} pending={startingMeal} error={error} onClose={() => setKitchenOpen(false)} onCook={meal => void cook(meal)} />}
        {(placing || selected || (error && !kitchenOpen && !wakeTarget)) && <div className={styles.actions}>
          <strong>{furnitureDefinition((placing ?? selected ?? "wooden-stool")).name}</strong>
          {error && <p role="alert">{error}</p>}
          {placing && <>
            <div>{preview?.fixed && <button disabled={saving || !!preview.error} onClick={() => preview && void save(replaceFurniture(appearanceRef.current.furniture ?? [], preview.item))}>{saving ? "Saving…" : "Confirm"}</button>}
            {canRotateFurniture(placing) && <button disabled={saving} onClick={() => scene.current?.rotatePlacement()}>Rotate</button>}
            <button disabled={saving} onClick={cancelPlacement}>Cancel</button></div>
          </>}
          {selected && !placing && <div>
            <button disabled={saving} onClick={() => choose(selected)}>Move</button>
            <button disabled={saving} onClick={() => void save(removeFurniture(appearanceRef.current.furniture ?? [], selected))}>Put away</button>
            <button disabled={saving} onClick={() => { setSelected(null); setError(null); }}>Close</button>
          </div>}
        </div>}
        <Dialog.Root open={furnishOpen} onOpenChange={open => { setFurnishOpen(open); scene.current?.lockFurniture(open); }}>
          <Dialog.Portal>
            <Dialog.Overlay className={`${drawerStyles["manage-dialog-overlay"]} ${styles.drawerOverlay}`} />
            <Dialog.Content className={`${drawerStyles["manage-dialog-content"]} ${kitchen.drawer} ${styles.furnitureDrawer}`} aria-describedby={undefined}>
              <header className={kitchen.drawerHeader}><Dialog.Title>Furnish your home</Dialog.Title><Dialog.Close asChild><button aria-label="Close furniture"><Cross2Icon aria-hidden="true" /></button></Dialog.Close></header>
              <HomeFurnitureCatalogue attendance={snapshot.farm.progression?.stats.attendance} earned={snapshot.farm.progression?.stats.achievementTreasures ?? []} level={snapshot.farm.progression?.level ?? 1} furniture={appearance.furniture ?? []}
                onSelect={(key, placed) => {
                  setFurnishOpen(false); scene.current?.lockFurniture(false);
                  if (placed) setSelected(key); else choose(key);
                }} />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
