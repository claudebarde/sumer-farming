import { Popover } from "radix-ui";
import type { FarmSnapshot } from "../../schemas/farm";
import type { IsometricTileAnchor } from "../game/phaser/scenes/IsometricFarmScene";
import { isometricTilePopup } from "../game/phaser/isometricTilePopup";
import FarmerPopupStatus from "./FarmerPopupStatus";
import FarmerPortrait from "./FarmerPortrait";
import IsometricMillActions from "./IsometricMillActions";
import BuildingActionIcon from "./BuildingActionIcon";
import buildingActionStyles from "../styles/BuildingActionButton.module.scss";
import type { MillRecipe, MillWorker } from "../../game-data/milling";
import { TILE_SIZE } from "../game/phaser/config";
import BuildingStorageTables from "./BuildingStorageTables";
import GranaryStorageCard from "./GranaryStorageCard";
import styles from "../styles/IsometricTest.module.scss";
import { barleyStoragePlan } from "../game/phaser/isometricStorage";
import { plantingBlocker } from "../game/phaser/isometricPlanting";
import { buildingDemolitionReason } from "../../game-core/farm/buildingDemolition";
import { materialLabel } from "../game/phaser/isometricGathering";
import { transferBlocker } from "../game/phaser/isometricGathering";
import { FISH_CAPACITY } from "../../game-data/fishing";
import MapCuneiformLabel from "./MapCuneiformLabel";
import { farmerNameCuneiform } from "../../game-data/farmerNameCuneiform";
import { millStorageBlocker } from "../game/phaser/isometricMillDelivery";
import { evaluateProgression } from "../../game-core/farm/progression";
import { canBakeBread, breadStorageBlocker } from "../game/phaser/isometricBaking";
import { canSupplyBrewery, waterPourTarget } from "../game/phaser/isometricBrewing";
import type { BrewerySupplyAction } from "../../game-core/farm/brewerySupplies";
import { INITIAL_FARM_CONFIG } from "../../game-data/initialFarm";
import BrewingRequirements from "./BrewingRequirements";
import ProductionProgress from "./ProductionProgress";
import { productionOutputFits, OUTPUT_FULL_MESSAGE } from "../../game-core/farm/productionOutputCapacity";
import { BREAD_RECIPE } from "../../game-data/production";
import { BEER_RECIPE } from "../../game-data/brewing";

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
  onMill?: (recipe: MillRecipe, worker: MillWorker) => void;
  onPickupMill?: (id: string) => void;
  onClaimLevel?: () => void;
  onBake?: () => void;
  onStoreBread?: (id: string) => void;
  onBreweryAction?: (action: BrewerySupplyAction) => void;
}) {
  const content = isometricTilePopup(snapshot, anchor.cell, now);
  const farmer = anchor.kind === "farmer";
  const bakingJob = !farmer && anchor.kind !== "breadBasket" && content.building?.type === "breadOven"
    ? snapshot.farm.production.baking[content.building.id] : undefined;
  const millingJob = !farmer && anchor.kind !== "millBags" && content.building?.type === "mill" &&
    snapshot.farm.milling?.buildingId === content.building.id ? snapshot.farm.milling : undefined;
  const brewingJob = !farmer && anchor.kind !== "beerJars" && content.building?.type === "brewery"
    ? snapshot.farm.production.brewing?.[content.building.id] : undefined;
  const inventoryPopup = !farmer && (content.home || content.building?.type === "warehouse");
  const granaryInventory = !farmer && content.building?.type === "granary" && Date.parse(content.building.completesAt) <= now ? content.building : null;
  const bags = anchor.kind === "millBags";
  const bread = anchor.kind === "breadBasket" || anchor.kind === "beerJars";
  const millOutput = bags && content.building ? snapshot.farm.millGoods.pending[content.building.id] : null;
  const outputQuantity = bags ? (millOutput?.flour ?? 0) + (millOutput?.brewersGroats ?? 0)
    : bread && content.building ? snapshot.farm.production.pending[content.building.id]?.quantity ?? 0 : null;
  const breadStorageReason = bread && content.building ? breadStorageBlocker(snapshot, content.building.id, now) : null;
  const millStorageReason = bags && content.building ? millStorageBlocker(snapshot, content.building.id, now) : null;
  const progress = evaluateProgression(snapshot, now);
  const demolitionReason = content.building ? buildingDemolitionReason(snapshot, content.building.id, now) : null;
  const title = anchor.kind === "beerJars" ? "Beer jars" : bread ? "Bread basket" : bags ? "Mill bags" : farmer ? snapshot.farm.farmerProfile?.identity.name ?? "Farmer" : content.title;
  const nameCuneiform = farmer ? farmerNameCuneiform(title) : "";
  const storage = farmer ? barleyStoragePlan(snapshot, anchor.cell, now) : null;
  const granaryStorage = !farmer && content.building?.type === "granary"
    ? barleyStoragePlan(snapshot, anchor.cell, now, content.building.id) : null;
  const carriedBarley = snapshot.farm.carriedItem?.itemKey === "barley" ? snapshot.farm.carriedItem.quantity : 0;
  const warehouseComplete = snapshot.buildings.some(b => b.type === "warehouse" && Date.parse(b.completesAt) <= now);
  const pourTarget = farmer && snapshot.farm.carriedItem?.itemKey === "water" ? waterPourTarget(snapshot, anchor.cell, now) : null;
  return <Popover.Root open onOpenChange={open => { if (!open) onClose(); }}>
    <Popover.Anchor asChild><span className={styles.popupAnchor} style={{ left: anchor.x, top: anchor.y + 90 }} /></Popover.Anchor>
    <Popover.Portal><Popover.Content key={`${anchor.kind}:${anchor.cell.column}:${anchor.cell.row}`} className={styles.tilePopup} side="top" sideOffset={8} collisionPadding={12}
      style={{ width: inventoryPopup ? 560 : undefined, maxWidth: `min(${inventoryPopup ? 560 : TILE_SIZE * 6}px, calc(100vw - 24px))` }} aria-label={title}
      onCloseAutoFocus={event => event.preventDefault()}>
      <div className={`${styles.popupBody} ${inventoryPopup ? styles.inventoryBody : ""}`}>
      <div className={`${styles.popupHeader} ${farmer ? styles.farmerHeader : ""}`}>
        {farmer && <FarmerPortrait name={title} variant="headshot" />}
        <h2>{!farmer && <MapCuneiformLabel element={title} />}<span>{title}{outputQuantity !== null && ` (${outputQuantity})`}</span>{nameCuneiform && <span className="cuneiforms">{nameCuneiform}</span>}</h2>
        {!farmer && !bread && !bags && content.level !== null && <span className={styles.levelBadge} aria-label={`${content.title} level ${content.level}`}>Lvl {content.level}</span>}
      </div>
      <Popover.Close className={styles.popupClose} aria-label="Close tile popup"><span aria-hidden="true">×</span></Popover.Close>
      {farmer ? <>
        <FarmerPopupStatus snapshot={snapshot} now={now} walking={anchor.walking} />
      </> : content.details
        .filter(detail => !granaryInventory || !detail.endsWith(" barley stored"))
        .filter(detail => outputQuantity === null || !/^\d+ (?:bread|beer|flour bags?|groats bags?) ready$/.test(detail)).map(detail => <p key={detail}>{detail}</p>)}
      {granaryInventory && <GranaryStorageCard quantity={granaryInventory.storedBarley} farmLevel={snapshot.farm.progression?.level ?? 1} />}
      {bakingJob && <ProductionProgress job={bakingJob} now={now} label="Baking progress" />}
      {millingJob && <ProductionProgress job={millingJob} now={now} label="Milling progress" />}
      {brewingJob && <ProductionProgress job={brewingJob} now={now} label="Brewing progress" />}
      {!farmer && (content.home || content.building?.type === "warehouse") && <BuildingStorageTables location={content.home ? "farm" : "warehouse"} inventory={snapshot.inventory}
        visual
        barley={content.home ? snapshot.inventory.find(i => i.itemKey === "barley")?.quantity ?? 0 : content.building?.storedBarley ?? 0}
        warehouseComplete={warehouseComplete} showFish={(snapshot.farm.progression?.level ?? 1) >= 4} showDates={(snapshot.farm.progression?.level ?? 1) >= 9} />}
      {!farmer && !bread && !bags && content.building?.type === "brewery" && <BrewingRequirements snapshot={snapshot} building={content.building} />}
      <div className={styles.popupActions}>
        {!farmer && !bread && !bags && content.building &&
          (content.building.type === "breadOven" || content.building.type === "brewery") &&
          !productionOutputFits(snapshot.farm, content.building.id, content.building.type === "breadOven" ? BREAD_RECIPE.output : BEER_RECIPE.output) &&
          <button disabled>{OUTPUT_FULL_MESSAGE}</button>}
        {farmer && onBreweryAction && pourTarget && canSupplyBrewery(snapshot, pourTarget, "pour_water", now) &&
          <button onClick={() => onBreweryAction("pour_water")}>Discard water</button>}
        {!farmer && !bread && onBreweryAction && <>
          {content.building?.type === "brewery" && ([['deliver', 'Deliver water'], ['stock_jars', 'Stock empty jars'], ['start_brewing', 'Brew beer']] as const).map(([action, label]) =>
            canSupplyBrewery(snapshot, content.building!, action, now) && <button key={action} className={action === "stock_jars" || action === "start_brewing" ? buildingActionStyles.button : undefined} onClick={() => onBreweryAction(action)}>
              {action === "stock_jars" && <BuildingActionIcon kind="emptyJars" />}{action === "start_brewing" && <BuildingActionIcon kind="brewBeer" />}<span>{label}</span>
            </button>)}
          {content.title === "River" && canSupplyBrewery(snapshot, { column: anchor.cell.column, row: INITIAL_FARM_CONFIG.riverRow }, "collect_water", now) && <button className={buildingActionStyles.button} onClick={() => onBreweryAction("collect_water")}><BuildingActionIcon kind="emptyJars" /><span>Collect water</span></button>}
          {content.title === "River" && canSupplyBrewery(snapshot, anchor.cell, "pour_water", now) && <button onClick={() => onBreweryAction("pour_water")}>Pour water</button>}
        </>}
        {bread && content.building && onStoreBread && <>
          {breadStorageReason && <p>{breadStorageReason}</p>}
          <button disabled={breadStorageReason !== null} onClick={() => onStoreBread(content.building!.id)}>Store</button>
        </>}
        {(farmer || content.home) && snapshot.farm.production.delivery && onStoreBread && <button onClick={() => onStoreBread(snapshot.farm.production.delivery!.buildingId)}>Store {snapshot.farm.production.delivery.itemKey}</button>}
        {!farmer && !bread && content.building?.type === "breadOven" && onBake && canBakeBread(snapshot, content.building.id, now) && <button className={buildingActionStyles.button} onClick={onBake}><BuildingActionIcon kind="bread" /><span>Bake bread</span></button>}
        {!farmer && !bags && content.home && progress.canClaim && onClaimLevel && <button onClick={onClaimLevel}>Claim level {progress.nextLevel}</button>}
        {bags && content.building && onPickupMill && <>
          {millStorageReason && <p>{millStorageReason}</p>}
          <button disabled={millStorageReason !== null} onClick={() => onPickupMill(content.building!.id)}>Store</button>
        </>}
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
        {content.actions.fish && onFish && <button className={buildingActionStyles.button} onClick={onFish}><BuildingActionIcon kind="fish" /><span>Go fishing</span></button>}
        {carriedBarley > 0 && granaryStorage?.hasStorage && !plantingBlocker(snapshot, now) && <button onClick={() => onStore(content.building!.id)}>Store barley</button>}
        {content.actions.gather && <button className={content.actions.gather === "reed" ? buildingActionStyles.button : undefined} onClick={() => onGather(content.actions.gather!)}>
          {content.actions.gather === "reed" && <BuildingActionIcon kind="reed" />}<span>Collect {materialLabel(content.actions.gather)}</span>
        </button>}
        {content.actions.pickup && <button onClick={onPickup}>Pick up {materialLabel(content.groundItem!.itemKey)}</button>}
        {content.actions.irrigation && <button className={buildingActionStyles.button} onClick={onBuildIrrigation}><BuildingActionIcon kind="irrigation" /><span>Build irrigation canal</span></button>}
        {content.actions.destroyIrrigation && <button onClick={onDestroyIrrigation}>Destroy</button>}
        {content.actions.road && <button className={buildingActionStyles.button} onClick={onBuildRoad}><BuildingActionIcon kind="road" /><span>Build road</span></button>}
        {content.actions.destroyRoad && <button onClick={onDestroyRoad}>Destroy</button>}
        {content.actions.drop && <button onClick={onDrop}>Drop {materialLabel(snapshot.farm.carriedItem!.itemKey)}</button>}
        {content.actions.plant && <button className={buildingActionStyles.button} onClick={() => onSelect("plant", content.home ? undefined : anchor.cell)}><BuildingActionIcon kind="plantBarley" /><span>Plant barley</span></button>}
        {content.actions.harvest && <button className={buildingActionStyles.button} onClick={() => onSelect("harvest", content.home ? undefined : anchor.cell)}><BuildingActionIcon kind="harvestBarley" /><span>Harvest barley</span></button>}
        {content.actions.walk && <button className={buildingActionStyles.button} onClick={onWalk}><BuildingActionIcon kind="walk" /><span>Walk here</span></button>}
        {content.actions.destroyMaterial && <button onClick={onDestroyMaterial}>Destroy {materialLabel(content.groundItem!.itemKey)}</button>}
        {content.building && !demolitionReason && <button className={["mill", "brewery", "breadOven"].includes(content.building.type) ? buildingActionStyles.button : undefined} onClick={() => onDestroyBuilding(content.building!.id)}>
          {["mill", "brewery", "breadOven"].includes(content.building.type) && <BuildingActionIcon kind="destroy" />}<span>Destroy the building</span>
        </button>}
        </>}
        </>}
      </div>
      </div>
      <Popover.Arrow className={styles.popupArrow} width={20} height={10} aria-hidden="true" />
    </Popover.Content></Popover.Portal>
  </Popover.Root>;
}
