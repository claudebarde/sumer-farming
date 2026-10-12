import { Popover } from "radix-ui";
import type { FarmSnapshot } from "../../schemas/farm";
import type { IsometricTileAnchor } from "../game/phaser/scenes/IsometricFarmScene";
import { hasFarmerPopup, isometricTilePopup } from "../game/phaser/isometricTilePopup";
import { TILE_SIZE } from "../game/phaser/config";
import BuildingStorageTables from "./BuildingStorageTables";
import styles from "../styles/IsometricTest.module.scss";
import { barleyStoragePlan } from "../game/phaser/isometricStorage";
import { plantingBlocker } from "../game/phaser/isometricPlanting";
import { buildingDemolitionReason } from "../../game-core/farm/buildingDemolition";
import { materialLabel } from "../game/phaser/isometricGathering";

export default function IsometricTilePopup({ snapshot, anchor, now, onClose, onSelect, onWalk, onDrop, onPickup, onGather, onBuildIrrigation, onBuildRoad, onStore, onDestroyBuilding }: {
  snapshot: FarmSnapshot; anchor: IsometricTileAnchor; now: number; onClose: () => void;
  onSelect: (mode: "plant" | "harvest", initial?: IsometricTileAnchor["cell"]) => void; onWalk: () => void; onDrop: () => void; onPickup: () => void; onBuildIrrigation: () => void; onBuildRoad: () => void;
  onStore: (granaryId?: string) => void;
  onGather: (itemKey: "reed" | "clay") => void;
  onDestroyBuilding: (buildingId: string) => void;
}) {
  const content = isometricTilePopup(snapshot, anchor.cell, now);
  const farmer = anchor.kind === "farmer";
  const demolitionReason = content.building ? buildingDemolitionReason(snapshot, content.building.id, now) : null;
  const title = farmer ? snapshot.farm.farmerProfile?.identity.name ?? "Farmer" : content.title;
  const storage = farmer ? barleyStoragePlan(snapshot, anchor.cell, now) : null;
  const granaryStorage = !farmer && content.building?.type === "granary"
    ? barleyStoragePlan(snapshot, anchor.cell, now, content.building.id) : null;
  const carriedBarley = snapshot.farm.carriedItem?.itemKey === "barley" ? snapshot.farm.carriedItem.quantity : 0;
  const warehouseComplete = snapshot.buildings.some(b => b.type === "warehouse" && Date.parse(b.completesAt) <= now);
  // A refreshed snapshot can empty his hands while this anchor is still open.
  if (farmer && !hasFarmerPopup(snapshot)) return null;
  return <Popover.Root open onOpenChange={open => { if (!open) onClose(); }}>
    <Popover.Anchor asChild><span className={styles.popupAnchor} style={{ left: anchor.x, top: anchor.y + 90 }} /></Popover.Anchor>
    <Popover.Portal><Popover.Content key={`${anchor.kind}:${anchor.cell.column}:${anchor.cell.row}`} className={styles.tilePopup} side="top" sideOffset={8} collisionPadding={12}
      style={{ maxWidth: `min(${TILE_SIZE * 6}px, calc(100vw - 24px))` }} aria-label={title}
      onCloseAutoFocus={event => event.preventDefault()}>
      <div className={styles.popupBody}>
      <div className={styles.popupHeader}>
        <h2>{title}</h2>
        {!farmer && content.level !== null && <span className={styles.levelBadge} aria-label={`${content.home ? "Farm" : "Granary"} level ${content.level}`}>Lvl {content.level}</span>}
      </div>
      <Popover.Close className={styles.popupClose} aria-label="Close tile popup"><span aria-hidden="true">×</span></Popover.Close>
      {farmer ? carriedBarley > 0 && <p>Carrying {carriedBarley} barley</p> : content.details.map(detail => <p key={detail}>{detail}</p>)}
      {!farmer && (content.home || content.building?.type === "warehouse") && <BuildingStorageTables location={content.home ? "farm" : "warehouse"} inventory={snapshot.inventory}
        barley={content.home ? snapshot.inventory.find(i => i.itemKey === "barley")?.quantity ?? 0 : content.building?.storedBarley ?? 0}
        warehouseComplete={warehouseComplete} showFish={(snapshot.farm.progression?.level ?? 1) >= 4} showDates={(snapshot.farm.progression?.level ?? 1) >= 9} />}
      <div className={styles.popupActions}>
        {farmer && carriedBarley > 0 && storage && (!storage.hasStorage
          ? <button disabled>No storage available</button>
          : storage.plan && !plantingBlocker(snapshot, now) && <button onClick={() => onStore()}>Store barley</button>)}
        {!farmer && <>
        {carriedBarley > 0 && granaryStorage?.hasStorage && !plantingBlocker(snapshot, now) && <button onClick={() => onStore(content.building!.id)}>Store barley</button>}
        {content.actions.gather && <button onClick={() => onGather(content.actions.gather!)}>Collect {materialLabel(content.actions.gather)}</button>}
        {content.actions.pickup && <button onClick={onPickup}>Pick up {materialLabel(content.groundItem!.itemKey)}</button>}
        {content.actions.irrigation && <button onClick={onBuildIrrigation}>Build irrigation canal</button>}
        {content.actions.road && <button onClick={onBuildRoad}>Build road</button>}
        {content.actions.drop && <button onClick={onDrop}>Drop {materialLabel(snapshot.farm.carriedItem!.itemKey)}</button>}
        {content.actions.plant && <button onClick={() => onSelect("plant", content.home ? undefined : anchor.cell)}>Plant barley</button>}
        {content.actions.harvest && <button onClick={() => onSelect("harvest", content.home ? undefined : anchor.cell)}>Harvest barley</button>}
        {content.actions.walk && <button onClick={onWalk}>Walk here</button>}
        {content.building && !demolitionReason && <button onClick={() => onDestroyBuilding(content.building!.id)}>Destroy the building</button>}
        </>}
      </div>
      </div>
      <Popover.Arrow className={styles.popupArrow} width={20} height={10} aria-hidden="true" />
    </Popover.Content></Popover.Portal>
  </Popover.Root>;
}
