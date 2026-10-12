import type { FarmSnapshot } from "../../schemas/farm";
import { FARM_BUILDING_DEFINITIONS } from "../../game-data/buildings";
import { granaryCapacityForLevel } from "../../game-data/storage";
import { granaryLimitForLevel } from "../../game-data/progression";
import granaryImage from "../../assets/sprite_assets/pngs/v2/isometric-test/granary-isometric-test.png";
import millImage from "../../assets/sprite_assets/pngs/v2/isometric-test/mill-isometric.png";
import breweryImage from "../../assets/sprite_assets/pngs/v2/isometric-test/brewery-isometric.png";
import breadOvenImage from "../../assets/sprite_assets/pngs/v2/isometric-test/bread-oven-isometric.png";
import warehouseImage from "../../assets/sprite_assets/pngs/v2/isometric-test/warehouse-isometric.png";
import smallShrineImage from "../../assets/sprite_assets/pngs/v2/isometric-test/small-shrine-isometric.png";
import { MARKET_ITEM_DEFINITIONS } from "../../game-data/marketItems";
import EstateBuildingCard from "./EstateBuildingCard";
import styles from "../styles/GameCanvas.module.scss";
import { granaryBuildBlocker } from "../game/phaser/isometricBuildingPlacement";

export default function IsometricBuildingCatalogue({ snapshot, now, onBuildGranary }: { readonly snapshot: FarmSnapshot; readonly now: number; readonly onBuildGranary?: () => void }) {
  const level = snapshot.farm.progression?.level ?? 1;
  const catalogue = [
    { type: "granary", name: "Granary", image: granaryImage, unlockLevel: 2, button: "Build granary",
      description: `Store and protect up to ${granaryCapacityForLevel(level)} additional barley.` },
    { type: "mill", name: "Mill", image: millImage, unlockLevel: 5, button: "Build Mill",
      description: "Produce Flour or Brewer's Groats. The farmer is occupied during milling." },
    { type: "brewery", name: "Brewery", image: breweryImage, unlockLevel: 6, button: "Build brewery",
      description: `Brew beer to trade or give the farmer as a happiness treat. Buy brewing jars at the NPC market for ${MARKET_ITEM_DEFINITIONS.brewingVessels.npcMarket.buyPrice} shekels each. Materials are consumed when construction starts.` },
    { type: "breadOven", name: "Bread Oven", image: breadOvenImage, unlockLevel: 6, button: "Build Bread Oven",
      description: `Turn Flour into bread. Collect finished baskets and deliver them to storage. Buy baking tools at the NPC Baking market for ${MARKET_ITEM_DEFINITIONS.bakingTools.npcMarket.buyPrice} shekels each.` },
    { type: "warehouse", name: "Warehouse", image: warehouseImage, unlockLevel: 8, button: "Build Warehouse",
      description: "Stores 20 barley. Adds 10 storage each for bread, beer, flour, groats, reed and clay." },
    { type: "smallShrine", name: "Small shrine", image: smallShrineImage, unlockLevel: 8, button: "Build Small shrine",
      description: "Offer 2 bread or 2 beer to slow happiness decay by 25% for 12 hours. One shrine per farm." }
  ] as const;
  const available = (key: "reed" | "clay") => [...snapshot.inventory, ...snapshot.groundItems]
    .filter(item => item.itemKey === key).reduce((total, item) => total + item.quantity, 0);
  return <>
    <h2>Available buildings</h2>
    <p>Place buildings beside a road. Each building needs its own free road tile for loading goods.</p>
    <p>Other building placement coming soon.</p>
    <ul className={styles["building-list"]}>
      {catalogue.map(({ type, name, image, unlockLevel, description, button }) => {
        const definition = FARM_BUILDING_DEFINITIONS[type];
        const limit = type === "granary" ? granaryLimitForLevel(level) : 1;
        const count = snapshot.buildings.filter(building => building.type === type).length;
        const built = count > 0 && count >= limit;
        return <EstateBuildingCard key={type} name={name} image={image}>
          <p>{definition.footprint.columns}×{definition.footprint.rows} · {definition.constructionDurationMs / 60000} minutes · {available("reed")}/{definition.materials.reed} reed · {available("clay")}/{definition.materials.clay} clay
            {type === "brewery" && <> · {snapshot.inventory.find(item => item.itemKey === "brewingVessels")?.quantity ?? 0}/{FARM_BUILDING_DEFINITIONS.brewery.materials.brewingVessels} brewing jars</>}
            {type === "breadOven" && <> · {snapshot.inventory.find(item => item.itemKey === "bakingTools")?.quantity ?? 0}/{FARM_BUILDING_DEFINITIONS.breadOven.materials.bakingTools} baking tools</>}
          </p>
          <p>{description}</p>
          {type === "granary" && !built && level >= 2 && granaryBuildBlocker(snapshot, now) && <p>{granaryBuildBlocker(snapshot, now)}</p>}
          <button disabled={type !== "granary" || !onBuildGranary || !!granaryBuildBlocker(snapshot, now)} onClick={type === "granary" ? onBuildGranary : undefined}>{built ? "Already built" : level < unlockLevel ? `Unlock at level ${unlockLevel}` : button}</button>
        </EstateBuildingCard>;
      })}
    </ul>
  </>;
}
