import type { FarmSnapshot } from "../../schemas/farm";
import { Accordion } from "radix-ui";
import { ChevronDownIcon } from "@radix-ui/react-icons";
import BuildingRequirements from "./BuildingRequirements";
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
import { buildingAvailabilityBlocker, buildingBuildBlocker, type PlaceableBuilding } from "../game/phaser/isometricBuildingPlacement";

export default function IsometricBuildingCatalogue({ snapshot, now, onBuild }: { readonly snapshot: FarmSnapshot; readonly now: number; readonly onBuild?: (type: PlaceableBuilding) => void }) {
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
  const group = (entry: typeof catalogue[number]) => snapshot.buildings.some(b => b.type === entry.type)
    ? "built" : level < entry.unlockLevel ? "future" : "available";
  const sections = [
    { id: "available", title: "Available", empty: "No buildings available." },
    { id: "built", title: "Already built", empty: "No buildings built yet." },
    { id: "future", title: "Future unlocks", empty: "All buildings unlocked." }
  ] as const;
  return <>
    <h2>Buildings</h2>
    <Accordion.Root type="multiple" defaultValue={[catalogue.some(entry => group(entry) === "available") ? "available" : "built"]} className={styles["building-accordion"]}>
    {sections.map(section => {
      const entries = catalogue.filter(entry => group(entry) === section.id);
      return <Accordion.Item key={section.id} value={section.id}>
        <Accordion.Header className={styles["building-accordion-header"]}>
          <Accordion.Trigger className={styles["building-accordion-trigger"]}>
            <span>{section.title} ({entries.length})</span><ChevronDownIcon aria-hidden />
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content className={styles["building-accordion-content"]}>
        {entries.length === 0 ? <p>{section.empty}</p> : <ul className={styles["building-list"]}>
      {entries.map(({ type, name, image, unlockLevel, description, button }) => {
        const limit = type === "granary" ? granaryLimitForLevel(level) : 1;
        const count = snapshot.buildings.filter(building => building.type === type).length;
        const built = count > 0 && count >= limit;
        const blocker = buildingBuildBlocker(snapshot, now, type);
        const status = buildingAvailabilityBlocker(snapshot, now, type);
        return <EstateBuildingCard key={type} name={name} image={image}>
          <p>{description}</p>
          {section.id !== "built" && <>
          {section.id === "available" && <BuildingRequirements snapshot={snapshot} building={type} />}
          {!built && level >= unlockLevel && status && <p>{status}</p>}
          <button disabled={!onBuild || !!blocker} onClick={() => onBuild?.(type)}>{built ? "Already built" : level < unlockLevel ? `Unlock at level ${unlockLevel}` : button}</button>
          </>}
        </EstateBuildingCard>;
      })}
        </ul>}
        </Accordion.Content>
      </Accordion.Item>;
    })}
    </Accordion.Root>
  </>;
}
