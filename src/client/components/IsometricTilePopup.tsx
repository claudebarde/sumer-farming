import { Popover } from "radix-ui";
import type { FarmSnapshot } from "../../schemas/farm";
import type { IsometricTileAnchor } from "../game/phaser/scenes/IsometricFarmScene";
import { isometricTilePopup } from "../game/phaser/isometricTilePopup";
import FarmerPopupStatus from "./FarmerPopupStatus";
import FarmerPortrait from "./FarmerPortrait";
import IsometricMillActions from "./IsometricMillActions";
import type { MillRecipe } from "../../game-data/milling";
import { TILE_SIZE } from "../game/phaser/config";
import BuildingStorageTables from "./BuildingStorageTables";
import styles from "../styles/IsometricTest.module.scss";
import { barleyStoragePlan } from "../game/phaser/isometricStorage";
import { plantingBlocker } from "../game/phaser/isometricPlanting";
import { buildingDemolitionReason } from "../../game-core/farm/buildingDemolition";
import { materialLabel } from "../game/phaser/isometricGathering";
import { transferBlocker } from "../game/phaser/isometricGathering";
import { FISH_CAPACITY } from "../../game-data/fishing";
import MapCuneiformLabel from "./MapCuneiformLabel";
import { farmerNameCuneiform } from "../../game-data/farmerNameCuneiform";
import { canPickupMillBags } from "../game/phaser/isometricMillDelivery";
import { evaluateProgression } from "../../game-core/farm/progression";
import { canBakeBread, canStoreBread } from "../game/phaser/isometricBaking";
import { canSupplyBrewery } from "../game/phaser/isometricBrewing";
import type { BrewerySupplyAction } from "../../game-core/farm/brewerySupplies";
import { INITIAL_FARM_CONFIG } from "../../game-data/initialFarm";

export default function IsometricTilePopup({ snapshot, anchor, now, onClose, onSelect, onWalk, onDrop, onPickup, onGather, onFish, onFishTransfer, onBuildIrrigation, onDestroyIrrigation, onDestroyRoad, onBuildRoad, onStore, onDestroyBuilding, onDestroyMaterial, onMill, onPickupMill, onClaimLevel, onBake, onStoreBread, onBreweryAction }: {
  snapshot: FarmSnapshot; anchor: IsometricTileAnchor; now: number; onClose: () => void;
  onSelect: (mode: "plant" | "harvest", initial?: IsometricTileAnchor["cell"]) => void; onWalk: () => void; onDrop: () => void; onPickup: () => void; onBuildIrrigation: () => void; onBuildRoad: () => void;
  onStore: (granaryId?: string) => void;
  onGather: (itemKey: "reed" | "clay") => void;
  onFish?: () => void;
  onFishTransfer?: (action: "store" | "release") => void;
  onDestroyBuilding: (buildingId: string) => void;
  onDestroyMaterial: () => void;
  onDestroyIrrigation: () => void;
  onDestroyRoad?: () => void;
  onMill?: (recipe: MillRecipe) => void;
  onPickupMill?: (id: string) => void;
  onClaimLevel?: () => void;
  onBake?: () => void;
  onStoreBread?: (id: string) => void;
  onBreweryAction?: (action: BrewerySupplyAction) => void;
}) {
  const content = isometricTilePopup(snapshot, anchor.cell, now);
  const farmer = anchor.kind === "farmer";
  const bags = anchor.kind === "millBags";
  const bread = anchor.kind === "breadBasket" || anchor.kind === "beerJars";
  const progress = evaluateProgression(snapshot, now);
  const demolitionReason = content.building ? buildingDemolitionReason(snapshot, content.building.id, now) : null;
  const title = anchor.kind === "beerJars" ? "Beer jars" : bread ? "Bread basket" : bags ? "Mill bags" : farmer ? snapshot.farm.farmerProfile?.identity.name ?? "Farmer" : content.title;
  const nameCuneiform = farmer ? farmerNameCuneiform(title) : "";
  const storage = farmer ? barleyStoragePlan(snapshot, anchor.cell, now) : null;
  const granaryStorage = !farmer && content.building?.type === "granary"
    ? barleyStoragePlan(snapshot, anchor.cell, now, content.building.id) : null;
  const carriedBarley = snapshot.farm.carriedItem?.itemKey === "barley" ? snapshot.farm.carriedItem.quantity : 0;
  const warehouseComplete = snapshot.buildings.some(b => b.type === "warehouse" && Date.parse(b.completesAt) <= now);
  return <Popover.Root open onOpenChange={open => { if (!open) onClose(); }}>
    <Popover.Anchor asChild><span className={styles.popupAnchor} style={{ left: anchor.x, top: anchor.y + 90 }} /></Popover.Anchor>
    <Popover.Portal><Popover.Content key={`${anchor.kind}:${anchor.cell.column}:${anchor.cell.row}`} className={styles.tilePopup} side="top" sideOffset={8} collisionPadding={12}
      style={{ maxWidth: `min(${TILE_SIZE * 6}px, calc(100vw - 24px))` }} aria-label={title}
      onCloseAutoFocus={event => event.preventDefault()}>
      <div className={styles.popupBody}>
      <div className={`${styles.popupHeader} ${farmer ? styles.farmerHeader : ""}`}>
        {farmer && <FarmerPortrait name={title} variant="headshot" />}
        <h2>{!farmer && <MapCuneiformLabel element={title} />}<span>{title}</span>{nameCuneiform && <span className="cuneiforms">{nameCuneiform}</span>}</h2>
        {!farmer && content.level !== null && <span className={styles.levelBadge} aria-label={`${content.home ? "Farm" : "Granary"} level ${content.level}`}>Lvl {content.level}</span>}
      </div>
      <Popover.Close className={styles.popupClose} aria-label="Close tile popup"><span aria-hidden="true">×</span></Popover.Close>
      {farmer ? <>
        <FarmerPopupStatus snapshot={snapshot} now={now} walking={anchor.walking} />
      </> : content.details.map(detail => <p key={detail}>{detail}</p>)}
      {!farmer && (content.home || content.building?.type === "warehouse") && <BuildingStorageTables location={content.home ? "farm" : "warehouse"} inventory={snapshot.inventory}
        barley={content.home ? snapshot.inventory.find(i => i.itemKey === "barley")?.quantity ?? 0 : content.building?.storedBarley ?? 0}
        warehouseComplete={warehouseComplete} showFish={(snapshot.farm.progression?.level ?? 1) >= 4} showDates={(snapshot.farm.progression?.level ?? 1) >= 9} />}
      <div className={styles.popupActions}>
        {!farmer && !bread && onBreweryAction && <>
          {content.building?.type === "brewery" && ([['deliver', 'Deliver water'], ['stock_jars', 'Stock empty jars'], ['start_brewing', 'Brew beer']] as const).map(([action, label]) =>
            canSupplyBrewery(snapshot, content.building!, action, now) && <button key={action} onClick={() => onBreweryAction(action)}>{label}</button>)}
          {content.title === "River" && canSupplyBrewery(snapshot, { column: anchor.cell.column, row: INITIAL_FARM_CONFIG.riverRow }, "collect_water", now) && <button onClick={() => onBreweryAction("collect_water")}>Collect water</button>}
          {content.title === "River" && canSupplyBrewery(snapshot, anchor.cell, "pour_water", now) && <button onClick={() => onBreweryAction("pour_water")}>Pour water</button>}
        </>}
        {bread && content.building && onStoreBread && canStoreBread(snapshot, content.building.id, now) && <button onClick={() => onStoreBread(content.building!.id)}>Store</button>}
        {(farmer || content.home) && snapshot.farm.production.delivery && onStoreBread && <button onClick={() => onStoreBread(snapshot.farm.production.delivery!.buildingId)}>Store {snapshot.farm.production.delivery.itemKey}</button>}
        {!farmer && !bread && content.building?.type === "breadOven" && onBake && canBakeBread(snapshot, content.building.id, now) && <button onClick={onBake}>Bake bread</button>}
        {!farmer && !bags && content.home && progress.canClaim && onClaimLevel && <button onClick={onClaimLevel}>Claim level {progress.nextLevel}</button>}
        {bags && content.building && onPickupMill && canPickupMillBags(snapshot, content.building.id, now) && <button onClick={() => onPickupMill(content.building!.id)}>Store</button>}
        {!bags && !bread && <>
        {(farmer || content.home) && snapshot.farm.millGoods.delivery && onPickupMill && <button onClick={() => onPickupMill(snapshot.farm.millGoods.delivery!.millId)}>Store bags</button>}
        {!farmer && content.building?.type === "mill" && onMill && <IsometricMillActions snapshot={snapshot} buildingId={content.building.id} now={now} onMill={onMill} />}
        {farmer && carriedBarley > 0 && storage && (!storage.hasStorage
          ? <button disabled>No storage available</button>
          : storage.plan && !plantingBlocker(snapshot, now) && <button onClick={() => onStore()}>Store barley</button>)}
        {!farmer && <>
        {snapshot.farm.carriedItem?.itemKey === "fish" && !transferBlocker(snapshot, now) && onFishTransfer && <>
          {content.home && (snapshot.inventory.find(i => i.itemKey === "fish")?.quantity ?? 0) < FISH_CAPACITY && <button onClick={() => onFishTransfer("store")}>Store fish</button>}
          {content.title === "River" && <button onClick={() => onFishTransfer("release")}>Release fish</button>}
        </>}
        {content.actions.fish && onFish && <button onClick={onFish}>Go fishing</button>}
        {carriedBarley > 0 && granaryStorage?.hasStorage && !plantingBlocker(snapshot, now) && <button onClick={() => onStore(content.building!.id)}>Store barley</button>}
        {content.actions.gather && <button onClick={() => onGather(content.actions.gather!)}>Collect {materialLabel(content.actions.gather)}</button>}
        {content.actions.pickup && <button onClick={onPickup}>Pick up {materialLabel(content.groundItem!.itemKey)}</button>}
        {content.actions.irrigation && <button onClick={onBuildIrrigation}>Build irrigation canal</button>}
        {content.actions.destroyIrrigation && <button onClick={onDestroyIrrigation}>Destroy</button>}
        {content.actions.road && <button onClick={onBuildRoad}>Build road</button>}
        {content.actions.destroyRoad && <button onClick={onDestroyRoad}>Destroy</button>}
        {content.actions.drop && <button onClick={onDrop}>Drop {materialLabel(snapshot.farm.carriedItem!.itemKey)}</button>}
        {content.actions.plant && <button onClick={() => onSelect("plant", content.home ? undefined : anchor.cell)}>Plant barley</button>}
        {content.actions.harvest && <button onClick={() => onSelect("harvest", content.home ? undefined : anchor.cell)}>Harvest barley</button>}
        {content.actions.walk && <button onClick={onWalk}>Walk here</button>}
        {content.actions.destroyMaterial && <button onClick={onDestroyMaterial}>Destroy {materialLabel(content.groundItem!.itemKey)}</button>}
        {content.building && !demolitionReason && <button onClick={() => onDestroyBuilding(content.building!.id)}>Destroy the building</button>}
        </>}
        </>}
      </div>
      </div>
      <Popover.Arrow className={styles.popupArrow} width={20} height={10} aria-hidden="true" />
    </Popover.Content></Popover.Portal>
  </Popover.Root>;
}
