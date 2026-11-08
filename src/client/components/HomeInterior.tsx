import { useEffect, useRef, useState } from "react";
import { Dialog, Tooltip } from "radix-ui";
import type { HomeInteriorScene } from "../game/home/HomeInteriorScene";
import GameTopBar from "./GameTopBar";
import SettingsDrawer from "./SettingsDrawer";
import RulesLink from "./RulesLink";
import BuildingActionIcon from "./BuildingActionIcon";
import { useNavigationTooltip } from "./useNavigationTooltip";
import bar from "../styles/IsometricTest.module.scss";
import actions from "../styles/BuildingActionButton.module.scss";
import type { FarmSnapshot } from "../../schemas/farm";
import { HOME_FURNITURE, canRotateFurniture, furnitureDefinition, type FurnitureKey, type FurniturePlacement } from "../../game-data/homeFurniture";
import { FURNITURE_ARTWORK } from "../game/home/furnitureArtwork";
import type { FurniturePreview } from "../game/home/HomeInteriorScene";
import { sendHomeFurniture } from "../api/homeAppearance";
import drawerStyles from "../styles/GameCanvas.module.scss";
import kitchen from "../styles/Kitchen.module.scss";
import styles from "../styles/HomeInterior.module.scss";

/** Independent visual interior. Visiting does not alter farm jobs or resources. */
export default function HomeInterior({ onClose, snapshot, clock, onSaved }: {
  readonly onClose: () => void; readonly snapshot: FarmSnapshot; readonly clock: number; readonly onSaved: (snapshot: FarmSnapshot) => void;
}) {
  const appearance = snapshot.farm.homeAppearance;
  const tooltip = useNavigationTooltip();
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const scene = useRef<HomeInteriorScene | null>(null);
  const interiorContent = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [furnishOpen, setFurnishOpen] = useState(false);
  const [placing, setPlacing] = useState<FurnitureKey | null>(null);
  const [selected, setSelected] = useState<FurnitureKey | null>(null);
  const [preview, setPreview] = useState<FurniturePreview | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const appearanceRef = useRef(appearance);
  useEffect(() => { appearanceRef.current = appearance; scene.current?.setFurniture(appearance.furniture ?? []); }, [appearance]);
  const cancelPlacement = () => { scene.current?.cancelPlacement(); setPlacing(null); setError(null); };
  const choose = (key: FurnitureKey) => {
    setFurnishOpen(false); setSelected(null); setError(null); setPlacing(key);
    scene.current?.lockFurniture(false); scene.current?.beginPlacement(key);
  };
  const save = async (items: readonly FurniturePlacement[]) => {
    if (savingRef.current) return;
    savingRef.current = true; setSaving(true); setError(null); scene.current?.lockFurniture(true);
    try {
      const next = await sendHomeFurniture(appearanceRef.current.furnitureRevision ?? 0, items);
      appearanceRef.current = next.farm.homeAppearance;
      scene.current?.setFurniture(next.farm.homeAppearance.furniture ?? []);
      onSaved(next); cancelPlacement(); setSelected(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save your furniture."); }
    finally { savingRef.current = false; setSaving(false); scene.current?.lockFurniture(false); }
  };
  const exitRequested = useRef(false);
  const leave = () => {
    if (exitRequested.current || savingRef.current) return;
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
      const interior = new HomeInteriorScene(() => { if (!disposed) setLoading(false); }, setPreview, key => { setSelected(key); setError(null); });
      interior.setFurniture(appearanceRef.current.furniture ?? []);
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
        onEscapeKeyDown={event => { if (saving || placing || selected) { event.preventDefault(); if (!saving) { cancelPlacement(); setSelected(null); } } }}>
        <Dialog.Title className={styles.accessibleTitle}>Your home</Dialog.Title>
        <GameTopBar snapshot={snapshot} clock={clock} zoomDisabled={loading}
          onZoomIn={() => scene.current?.zoomBy(1.2)} onZoomOut={() => scene.current?.zoomBy(1 / 1.2)} onFit={() => scene.current?.fit()}>
          <div className={bar.manageControls}><div className={bar.manageButtonRow}>
            <Tooltip.Provider delayDuration={300}>
              <Tooltip.Root {...tooltip("furniture")}>
                <Tooltip.Trigger asChild>
                  <button className={`${bar.manageButton} ${actions.button} ${bar.manageIconButton}`} disabled={loading || leaving || saving}
                    aria-label="Furniture" onClick={() => { cancelPlacement(); setSelected(null); scene.current?.lockFurniture(true); setFurnishOpen(true); }}>
                    <img className={styles.furnitureIcon} src={FURNITURE_ARTWORK["wooden-stool"]} alt="" />
                    <span className={bar.controlLabel}>Furniture</span>
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Portal><Tooltip.Content className={bar.navigationTooltip} side="bottom" sideOffset={6}>Furnish your home<Tooltip.Arrow className={bar.navigationTooltipArrow} /></Tooltip.Content></Tooltip.Portal>
              </Tooltip.Root>
              <Tooltip.Root {...tooltip("home-return")}>
                <Tooltip.Trigger asChild>
                  <button className={`${bar.manageButton} ${actions.button} ${bar.manageIconButton} ${bar.travelButton}`} disabled={leaving || saving} aria-label="Back to your farm" onClick={leave}>
                    <BuildingActionIcon kind="farm" /><span className={bar.controlLabel}>Your farm</span>
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Portal><Tooltip.Content className={bar.navigationTooltip} side="bottom" sideOffset={6}>{leaving ? "Leaving home…" : "Back to your farm"}<Tooltip.Arrow className={bar.navigationTooltipArrow} /></Tooltip.Content></Tooltip.Portal>
              </Tooltip.Root>
              <SettingsDrawer layer={1400} onOpen={() => { if (!saving) { cancelPlacement(); setSelected(null); } }} />
              <RulesLink toolbar />
            </Tooltip.Provider>
          </div></div>
        </GameTopBar>
        <div className={styles.viewport} ref={setHost} role="region" aria-label="Home interior. Click the floor to walk.">
          {loading && <p className={styles.loading} role="status">{failed ? "Unable to load your home. Please close it and try again." : "Loading your home…"}</p>}
        </div>
        {(placing || selected || error) && <div className={styles.actions}>
          <strong>{furnitureDefinition((placing ?? selected ?? "wooden-stool")).name}</strong>
          {error && <p role="alert">{error}</p>}
          {placing && <>
            <div><button disabled={saving || !preview || !!preview.error} onClick={() => preview && void save([...(appearanceRef.current.furniture ?? []).filter(i => i.key !== placing), preview.item])}>{saving ? "Saving…" : "Place"}</button>
            {canRotateFurniture(placing) && <button disabled={saving} onClick={() => scene.current?.rotatePlacement()}>Rotate</button>}
            <button disabled={saving} onClick={cancelPlacement}>Cancel</button></div>
          </>}
          {selected && !placing && <div>
            <button disabled={saving} onClick={() => choose(selected)}>Move</button>
            <button disabled={saving} onClick={() => void save((appearanceRef.current.furniture ?? []).filter(i => i.key !== selected))}>Put away</button>
            <button disabled={saving} onClick={() => { setSelected(null); setError(null); }}>Close</button>
          </div>}
        </div>}
        <Dialog.Root open={furnishOpen} onOpenChange={open => { setFurnishOpen(open); scene.current?.lockFurniture(open); }}>
          <Dialog.Portal>
            <Dialog.Overlay className={`${drawerStyles["manage-dialog-overlay"]} ${styles.drawerOverlay}`} />
            <Dialog.Content className={`${drawerStyles["manage-dialog-content"]} ${kitchen.drawer} ${styles.furnitureDrawer}`} aria-describedby={undefined}>
              <header className={kitchen.drawerHeader}><Dialog.Title>Furnish your home</Dialog.Title><Dialog.Close asChild><button aria-label="Close furniture">×</button></Dialog.Close></header>
              <div className={`${kitchen.drawerBody} ${styles.items}`}>
                {HOME_FURNITURE.map(item => {
                  const placed = appearance.furniture?.some(i => i.key === item.key);
                  const number = item.key.startsWith("woven-basket") || item.key.startsWith("clay-bowl") ? (item.key.endsWith("-2") ? " 2" : " 1") : "";
                  return <button key={item.key} data-placed={placed ? "true" : undefined} aria-label={`${item.name}${number}${placed ? ", placed in your home" : ""}`} onClick={() => { setFurnishOpen(false); scene.current?.lockFurniture(false); if (placed) setSelected(item.key); else choose(item.key); }}><img src={FURNITURE_ARTWORK[item.key]} alt="" /><strong>{item.name}{number}</strong>{placed && <small>Select</small>}</button>;
                })}
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
