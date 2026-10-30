import SesameCropContent, { SesameAction } from "./SesameCropContent";
import miniature from "../../assets/sprite_assets/pngs/v2/isometric-test/ziggurat/ziggurat-completed.png";
import PorterHireProgress from "./PorterHireProgress";
import { Popover } from "radix-ui";
import IsometricShrineActions from "./IsometricShrineActions";
import PerennialCropContent, { PerennialCropAction } from "./PerennialCropContent";
import { shrineBlessingActive } from "../../game-data/shrine";
import type { FarmSnapshot } from "../../schemas/farm";
import type { IsometricTileAnchor } from "../game/phaser/scenes/IsometricFarmScene";
import { isometricTilePopup } from "../game/phaser/isometricTilePopup";
import FarmerPopupStatus from "./FarmerPopupStatus";
import FarmerPortrait from "./FarmerPortrait";
import IsometricMillActions from "./IsometricMillActions";
import IsometricBuildingUpgrade from "./IsometricBuildingUpgrade";
import { activeBuildingUpgrade } from "../../game-data/buildingUpgrades";
import BuildingActionIcon from "./BuildingActionIcon";
import buildingActionStyles from "../styles/BuildingActionButton.module.scss";
import type { MillRecipe, MillWorker } from "../../game-data/milling";
import { TILE_SIZE } from "../game/phaser/config";
import BuildingStorageTables from "./BuildingStorageTables";
import GranaryStorageCard from "./GranaryStorageCard";
import styles from "../styles/IsometricTest.module.scss";
import { barleyStoragePlan, materialStoragePlan } from "../game/phaser/isometricStorage";
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
import BarleyGrowthProgress from "./BarleyGrowthProgress";
import { productionOutputFits, OUTPUT_FULL_MESSAGE } from "../../game-core/farm/productionOutputCapacity";
import { BREAD_RECIPE } from "../../game-data/production";
import { BEER_RECIPE } from "../../game-data/brewing";

export default function IsometricTilePopup({ snapshot, anchor, now, onClose, onSelect, onWalk, onDrop, onPickup, onGather, onFish, onFishTransfer, onBuildIrrigation, onDestroyIrrigation, onDestroyRoad, onStore, onDestroyBuilding, onDestroyMaterial, onMill, onPickupMill, onClaimLevel, onBake, onStoreBread, onBreweryAction, onOffer, getFarmerPosition, onRequestPalm, onStoreDecoration }: {
  snapshot: FarmSnapshot; anchor: IsometricTileAnchor; now: number; onClose: () => void;
  getFarmerPosition?: () => IsometricTileAnchor["cell"] | undefined;
  onRequestPalm?: () => void;
  onStoreDecoration?: (id: string) => void;
  onSelect: (mode: "plant" | "harvest", initial?: IsometricTileAnchor["cell"]) => void; onWalk: () => void; onDrop: () => void; onPickup: () => void; onBuildIrrigation: () => void;
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
  onOffer?: (item: "bread" | "beer") => void;
  onBreweryAction?: (action: BrewerySupplyAction) => void;
}) {
  const content = isometricTilePopup(snapshot, anchor.cell, now);
  const decorationObject = snapshot.objects.find(o => o.type === "miniatureZiggurat" && o.column === anchor.cell.column && o.row === anchor.cell.row);
  const decoration = anchor.kind === "tile" && snapshot.rewards.find(r => r.objectId === decorationObject?.id);
  const farmer = anchor.kind === "farmer";
  const porter = anchor.kind === "porter";
  const growingBarley = !farmer ? snapshot.crops.find(c => c.cropKey === "barley" && c.column === anchor.cell.column && c.row === anchor.cell.row &&
    !c.harvestCompletesAt && now >= Date.parse(c.plantedAt) && now < Date.parse(c.growthCompletesAt)) : undefined;
  const bakingJob = !farmer && anchor.kind !== "breadBasket" && content.building?.type === "breadOven"
    ? snapshot.farm.production.baking[content.building.id] : undefined;
  const millingJob = !farmer && anchor.kind !== "millBags" && content.building?.type === "mill" &&
    snapshot.farm.milling?.buildingId === content.building.id ? snapshot.farm.milling : undefined;
  const brewingJob = !farmer && anchor.kind !== "beerJars" && content.building?.type === "brewery"
    ? snapshot.farm.production.brewing?.[content.building.id] : undefined;
  const inventoryPopup = !porter && !farmer && (content.home || content.building?.type === "warehouse");
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
  const shrineBlessed = !farmer && content.building?.type === "smallShrine" &&
    shrineBlessingActive(snapshot.farm.production.shrineBlessing, now);
  const title = porter ? "Porter" : anchor.kind === "beerJars" ? "Beer jars" : bread ? "Bread basket" : bags ? "Mill bags" : farmer ? snapshot.farm.farmerProfile?.identity.name ?? "Farmer" : content.title;
  const nameCuneiform = farmer ? farmerNameCuneiform(title) : "";
  const storageContext = farmer || content.home || content.building?.type === "warehouse" || content.building?.type === "granary";
  const storageFrom = farmer ? anchor.cell : INITIAL_FARM_CONFIG.farmerSpawn;
  const storage = storageContext ? barleyStoragePlan(snapshot, storageFrom, now) : null;
  const materialStorage = storageContext ? materialStoragePlan(snapshot, storageFrom, now) : null;
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
        <h2>{!farmer && !porter && <MapCuneiformLabel element={title} />}<span>{title}{outputQuantity !== null && ` (${outputQuantity})`}</span>{nameCuneiform && <span className="cuneiforms">{nameCuneiform}</span>}</h2>
        {!porter && !farmer && !bread && !bags && content.level !== null && <span className={styles.levelBadge} aria-label={`${content.title} level ${content.level}`}>Lvl {content.level}</span>}
      </div>
      <Popover.Close className={styles.popupClose} aria-label="Close tile popup"><span aria-hidden="true">×</span></Popover.Close>
      {decoration ? <button className={buildingActionStyles.button} onClick={() => onStoreDecoration?.(decoration.id)}><img src={miniature} width={48} height={48} alt="" /><span>Return to storage</span></button> : porter ? <PorterHireProgress porter={snapshot.farm.production.porter} now={now} /> : <>
      {farmer ? <>
        <FarmerPopupStatus snapshot={snapshot} now={now} walking={anchor.walking} />
      </> : content.details
        .filter(detail => !growingBarley || !detail.startsWith("Ready in "))
        .filter(detail => !granaryInventory || !detail.endsWith(" barley stored"))
        .filter(detail => outputQuantity === null || !/^\d+ (?:bread|beer|flour bags?|groats bags?) ready$/.test(detail)).map(detail => <p key={detail}>{detail}</p>)}
      {granaryInventory && <GranaryStorageCard quantity={granaryInventory.storedBarley} farmLevel={snapshot.farm.progression?.level ?? 1} />}
      {!farmer && <SesameCropContent snapshot={snapshot} target={anchor.cell} now={now} getFarmerPosition={getFarmerPosition} onStarted={onClose} />}
      {growingBarley && <BarleyGrowthProgress crop={growingBarley} now={now} />}
      {!farmer && snapshot.crops.some(c => c.cropKey === "datePalm" && c.column === anchor.cell.column && c.row === anchor.cell.row) &&
        <PerennialCropContent snapshot={snapshot} target={anchor.cell} now={now} isometric getFarmerPosition={getFarmerPosition} onStarted={onClose} />}
      {!farmer && content.building?.type === "smallShrine" && <>
        <p>A quiet place to honour the gods and ask for a blessing over your household.</p>
        <p>Offerings of 2 bread or 2 beer will slow happiness decay by 25% for 12 hours.</p>
      </>}
      {bakingJob && <ProductionProgress job={bakingJob} now={now} label="Baking progress" />}
      {millingJob && <ProductionProgress job={millingJob} now={now} label="Milling progress" />}
      {brewingJob && <ProductionProgress job={brewingJob} now={now} label="Brewing progress" />}
      {!farmer && (content.home || content.building?.type === "warehouse") && <BuildingStorageTables location={content.home ? "farm" : "warehouse"} inventory={snapshot.inventory}
        visual
        barley={content.home ? snapshot.inventory.find(i => i.itemKey === "barley")?.quantity ?? 0 : content.building?.storedBarley ?? 0}
        warehouseComplete={warehouseComplete} warehouseId={content.building?.type === "warehouse" ? content.building.id : undefined} showFish={(snapshot.farm.progression?.level ?? 1) >= 4} showSesame={(snapshot.farm.progression?.level ?? 1) >= 10} showDates={(snapshot.farm.progression?.level ?? 1) >= 9} />}
      {!farmer && !bread && !bags && content.building?.type === "brewery" && !activeBuildingUpgrade(snapshot.farm.production.buildingUpgrades, content.building.id, now) && <BrewingRequirements snapshot={snapshot} building={content.building} />}
      <div className={styles.popupActions}>
        {!farmer && content.building?.type === "smallShrine" && <IsometricShrineActions snapshot={snapshot} buildingId={content.building.id} now={now} onOffer={onOffer} />}
        {!shrineBlessed && <>
        {!farmer && !bread && !bags && content.building &&
          (content.building.type === "breadOven" || content.building.type === "brewery") &&
          !activeBuildingUpgrade(snapshot.farm.production.buildingUpgrades, content.building.id, now) &&
          !productionOutputFits(snapshot.farm, content.building.id, content.building.type === "breadOven" ? BREAD_RECIPE.output : BEER_RECIPE.output) &&
          <button disabled>{OUTPUT_FULL_MESSAGE}</button>}
        {farmer && onBreweryAction && pourTarget && canSupplyBrewery(snapshot, pourTarget, "pour_water", now) &&
          <button className={buildingActionStyles.button} onClick={() => onBreweryAction("pour_water")}><BuildingActionIcon kind="water" /><span>Discard water</span></button>}
        {!farmer && !bread && onBreweryAction && <>
          {content.building?.type === "brewery" && !activeBuildingUpgrade(snapshot.farm.production.buildingUpgrades, content.building.id, now) && ([['deliver', 'Deliver water'], ['stock_jars', 'Stock empty jars'], ['start_brewing', 'Brew beer']] as const).map(([action, label]) =>
            canSupplyBrewery(snapshot, content.building!, action, now) && <button key={action} className={buildingActionStyles.button} onClick={() => onBreweryAction(action)}>
              {action === "deliver" && <BuildingActionIcon kind="water" />}{action === "stock_jars" && <BuildingActionIcon kind="emptyJars" />}{action === "start_brewing" && <BuildingActionIcon kind="brewBeer" />}<span>{label}</span>
            </button>)}
          {content.title === "River" && canSupplyBrewery(snapshot, { column: anchor.cell.column, row: INITIAL_FARM_CONFIG.riverRow }, "collect_water", now) && <button className={buildingActionStyles.button} onClick={() => onBreweryAction("collect_water")}><BuildingActionIcon kind="emptyJars" /><span>Collect water</span></button>}
          {content.title === "River" && canSupplyBrewery(snapshot, anchor.cell, "pour_water", now) && <button className={buildingActionStyles.button} onClick={() => onBreweryAction("pour_water")}><BuildingActionIcon kind="water" /><span>Pour water</span></button>}
        </>}
        {bread && content.building && onStoreBread && <>
          {breadStorageReason && <p>{breadStorageReason}</p>}
          <button className={buildingActionStyles.button} disabled={breadStorageReason !== null} onClick={() => onStoreBread(content.building!.id)}><BuildingActionIcon kind={anchor.kind === "beerJars" ? "beer" : "bread"} /><span>Store</span></button>
        </>}
        {(farmer || inventoryPopup) && snapshot.farm.production.delivery && onStoreBread && <button className={buildingActionStyles.button} onClick={() => onStoreBread(snapshot.farm.production.delivery!.buildingId)}><BuildingActionIcon kind={snapshot.farm.production.delivery.itemKey} /><span>Store {snapshot.farm.production.delivery.itemKey}</span></button>}
        {!farmer && !bread && content.building?.type === "breadOven" && onBake && canBakeBread(snapshot, content.building.id, now) && <button className={buildingActionStyles.button} onClick={onBake}><BuildingActionIcon kind="bread" /><span>Bake bread</span></button>}
        {!farmer && !bags && content.home && progress.canClaim && onClaimLevel && <button className={buildingActionStyles.button} onClick={onClaimLevel}><BuildingActionIcon kind="upgrade" /><span>Claim level {progress.nextLevel}</span></button>}
        {bags && content.building && onPickupMill && <>
          {millStorageReason && <p>{millStorageReason}</p>}
          <button className={buildingActionStyles.button} disabled={millStorageReason !== null} onClick={() => onPickupMill(content.building!.id)}>
            {(millOutput?.flour ?? 0) > 0 && <BuildingActionIcon kind="flour" />}
            {(millOutput?.brewersGroats ?? 0) > 0 && <BuildingActionIcon kind="groats" />}
            <span>Store</span>
          </button>
        </>}
        {!bags && !bread && <>
        {(farmer || inventoryPopup) && snapshot.farm.millGoods.delivery && onPickupMill && <button className={buildingActionStyles.button} onClick={() => onPickupMill(snapshot.farm.millGoods.delivery!.millId)}>
          {snapshot.farm.millGoods.delivery.bags.flour > 0 && <BuildingActionIcon kind="flour" />}
          {snapshot.farm.millGoods.delivery.bags.brewersGroats > 0 && <BuildingActionIcon kind="groats" />}
          <span>Store bags</span>
        </button>}
        {!farmer && content.building?.type === "mill" && <>
          {onMill && !activeBuildingUpgrade(snapshot.farm.production.buildingUpgrades, content.building.id, now) && <IsometricMillActions snapshot={snapshot} buildingId={content.building.id} now={now} onMill={onMill} />}
        </>}
        {storageContext && carriedBarley > 0 && storage && (!storage.hasStorage
          ? <button className={buildingActionStyles.button} disabled><BuildingActionIcon kind="barley" /><span>No storage available</span></button>
          : storage.plan && !plantingBlocker(snapshot, now) && <button className={buildingActionStyles.button} onClick={() => onStore()}><BuildingActionIcon kind="barley" /><span>Store barley</span></button>)}
        {(farmer || inventoryPopup) && materialStorage && !transferBlocker(snapshot, now) && <button className={buildingActionStyles.button} onClick={() => onStore()}>
          <BuildingActionIcon kind={snapshot.farm.carriedItem?.itemKey === "clay" ? "clay" : "reed"} className={snapshot.farm.carriedItem?.itemKey === "clay" ? buildingActionStyles.clayIcon : undefined} />
          <span>Store {snapshot.farm.carriedItem?.itemKey}</span>
        </button>}
        {!farmer && <>
        {snapshot.farm.carriedItem?.itemKey === "fish" && !transferBlocker(snapshot, now) && onFishTransfer && <>
          {content.home && (snapshot.inventory.find(i => i.itemKey === "fish")?.quantity ?? 0) < FISH_CAPACITY && <button className={buildingActionStyles.button} onClick={() => onFishTransfer("store")}><BuildingActionIcon kind="fish" /><span>Store fish</span></button>}
          {content.title === "River" && <button className={buildingActionStyles.button} onClick={() => onFishTransfer("release")}><BuildingActionIcon kind="fish" /><span>Release fish</span></button>}
        </>}
        {content.actions.fish && onFish && <button className={buildingActionStyles.button} onClick={onFish}><BuildingActionIcon kind="fish" /><span>Go fishing</span></button>}
        {content.actions.gather && <button className={buildingActionStyles.button} onClick={() => onGather(content.actions.gather!)}>
          <BuildingActionIcon kind={content.actions.gather} className={content.actions.gather === "clay" ? buildingActionStyles.clayIcon : undefined} /><span>Collect {materialLabel(content.actions.gather)}</span>
        </button>}
        {content.actions.pickup && <button className={buildingActionStyles.button} onClick={onPickup}>
          <BuildingActionIcon kind={content.groundItem?.itemKey === "clay" ? "clay" : content.groundItem?.itemKey === "reed" ? "reed" : "barley"} className={content.groundItem?.itemKey === "clay" ? buildingActionStyles.clayIcon : undefined} />
          <span>Pick up {materialLabel(content.groundItem!.itemKey)}</span>
        </button>}
        {content.actions.plant && <button className={buildingActionStyles.button} onClick={() => onSelect("plant", content.home ? undefined : anchor.cell)}><BuildingActionIcon kind="plantBarley" /><span>Plant barley</span></button>}
        {content.title === "Arable ground" && (snapshot.farm.progression?.level ?? 1) >= 9 &&
          <PerennialCropAction snapshot={snapshot} cropKey="datePalm" target={anchor.cell} now={now} action="plant" isometric getFarmerPosition={getFarmerPosition} onRequestPlant={onRequestPalm} />}
        {content.title === "Arable ground" && (snapshot.farm.progression?.level ?? 1) >= 10 &&
          <SesameAction snapshot={snapshot} target={anchor.cell} now={now} action="plant" getFarmerPosition={getFarmerPosition} onStarted={onClose} />}
        {content.actions.irrigation && <button className={buildingActionStyles.button} onClick={onBuildIrrigation}><BuildingActionIcon kind="irrigation" /><span>Build irrigation canal</span></button>}
        {content.actions.destroyIrrigation && <button className={buildingActionStyles.button} onClick={onDestroyIrrigation}><BuildingActionIcon kind="destroy" /><span>Destroy</span></button>}
        {content.actions.destroyRoad && <button className={buildingActionStyles.button} onClick={onDestroyRoad}><BuildingActionIcon kind="destroy" /><span>Destroy</span></button>}
        {content.actions.drop && <button className={buildingActionStyles.button} onClick={onDrop}>
          {snapshot.farm.carriedItem?.itemKey === "barley" && <BuildingActionIcon kind="barley" />}
          {snapshot.farm.carriedItem?.itemKey === "reed" && <BuildingActionIcon kind="reed" />}
          {snapshot.farm.carriedItem?.itemKey === "clay" && <BuildingActionIcon kind="clay" className={buildingActionStyles.clayIcon} />}
          <span>Drop {materialLabel(snapshot.farm.carriedItem!.itemKey)}</span>
        </button>}
        {content.actions.harvest && <button className={buildingActionStyles.button} onClick={() => onSelect("harvest", content.home ? undefined : anchor.cell)}><BuildingActionIcon kind="harvestBarley" /><span>Harvest barley</span></button>}
        {content.actions.walk && <button className={buildingActionStyles.button} onClick={onWalk}><BuildingActionIcon kind="walk" /><span>Walk here</span></button>}
        {content.actions.destroyMaterial && <button className={buildingActionStyles.button} onClick={onDestroyMaterial}><BuildingActionIcon kind="destroy" /><span>Destroy {materialLabel(content.groundItem!.itemKey)}</span></button>}
        {(content.building?.type === "mill" || content.building?.type === "breadOven" || content.building?.type === "brewery") && <IsometricBuildingUpgrade key={content.building.id} snapshot={snapshot} buildingId={content.building.id} now={now} onStarted={onClose} />}
        {content.building && !demolitionReason && <button className={buildingActionStyles.button} onClick={() => onDestroyBuilding(content.building!.id)}>
          <BuildingActionIcon kind="destroy" /><span>Destroy the building</span>
        </button>}
        </>}
        </>}
        </>}
      </div>
      </>}
      </div>
      <Popover.Arrow className={styles.popupArrow} width={20} height={10} aria-hidden="true" />
    </Popover.Content></Popover.Portal>
  </Popover.Root>;
}
