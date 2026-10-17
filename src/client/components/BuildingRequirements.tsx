import type { FarmSnapshot } from "../../schemas/farm";
import { FARM_BUILDING_DEFINITIONS, type FarmBuildingType } from "../../game-data/buildings";
import reed from "../../assets/sprite_assets/pngs/reed-bundle.png";
import clay from "../../assets/sprite_assets/pngs/brick-pile.png";
import jars from "../../assets/sprite_assets/pngs/beer-jars.png";
import tools from "../../assets/sprite_assets/pngs/wooden-baking-tools.png";
import styles from "../styles/BuildingRequirements.module.scss";
import MaterialRequirements from "./MaterialRequirements";

const materials = {
  reed: { name: "Reeds", image: reed },
  clay: { name: "Clay", image: clay },
  brewingVessels: { name: "Brewing jars", image: jars },
  bakingTools: { name: "Baking tools", image: tools }
} as const;

/** Mirrors construction availability: dropped reed/clay count, carried goods do not. */
export default function BuildingRequirements({ snapshot, building }: {
  readonly snapshot: FarmSnapshot; readonly building: FarmBuildingType;
}) {
  const definition = FARM_BUILDING_DEFINITIONS[building];
  return <div className={styles.requirements}>
    <div className={styles.summary}>
      <span>Size: {definition.footprint.columns}×{definition.footprint.rows}</span>
      <span>Building time: {definition.constructionDurationMs / 60000} minutes</span>
    </div>
    <MaterialRequirements label="Construction materials" items={(Object.entries(definition.materials) as [keyof typeof materials, number][]).map(([key, required]) => {
        const material = materials[key];
        const quantity = snapshot.inventory.filter(item => item.itemKey === key).reduce((sum, item) => sum + item.quantity, 0)
          + (key === "reed" || key === "clay" ? snapshot.groundItems.filter(item => item.itemKey === key).reduce((sum, item) => sum + item.quantity, 0) : 0);
        return { ...material, quantity, required };
      })} />
  </div>;
}
