import type { FarmSnapshot } from "../../schemas/farm";
import HappinessMeter from "./HappinessMeter";
import RationMeter from "./RationMeter";
import styles from "../styles/GameCanvas.module.scss";
import { farmerActivity } from "../game/phaser/farmerActivity";
import { FARM_SPRITES } from "../../assets/farmSprites";
import flour from "../../assets/sprite_assets/pngs/v2/isometric-test/mill-active/mill-flour-bags-isometric.png";
import brewersGroats from "../../assets/sprite_assets/pngs/v2/isometric-test/brewery/brewers-groats-icon.png";
import road from "../../assets/sprite_assets/pngs/v2/isometric-test/roads/road-ne-sw.png";
import canal from "../../assets/sprite_assets/pngs/v2/isometric-test/canals/canal-ne-sw.png";
import stool from "../../assets/sprite_assets/pngs/v2/isometric-test/farmer-idle-stool.png";
import pickaxe from "../../assets/sprite_assets/pngs/v2/isometric-test/farmer-building-pickaxe.png";

const activityImages = { barley: FARM_SPRITES.harvestedBarley, flour, brewersGroats, road, canal, stool, pickaxe,
  reed: FARM_SPRITES.reedBundle, clay: FARM_SPRITES.brickPile, fish: FARM_SPRITES.fish,
  bread: FARM_SPRITES.breadBasket, beer: FARM_SPRITES.beerJars, dates: FARM_SPRITES.datesBasket, water: FARM_SPRITES.water };

export default function FarmerPopupStatus({ snapshot, now, walking = false }: { readonly snapshot: FarmSnapshot; readonly now: number; readonly walking?: boolean }) {
  const household = snapshot.farm.household;
  const activity = farmerActivity(snapshot, now, walking);
  return <div className={`${styles["farmer-metrics"]} ${styles["farmer-popup-metrics"]}`}>
    <div><div className={styles["farmer-activity"]}>
      {activity.item && <img src={activityImages[activity.item]} alt={activity.item === "reed" ? "Reeds" : activity.item} />}
      {activity.item === "water" && <span className={`cuneiforms ${styles["farmer-water-sign"]}`} aria-hidden="true">𒀀</span>}
      {activity.quantity !== undefined && <span className={styles["farmer-activity-count"]}>{activity.quantity}</span>}
    </div><span>{activity.label}</span></div>
    <div><HappinessMeter value={household.happiness} /><span>Happiness</span></div>
    <div><RationMeter nextRationAt={household.nextBarleyConsumptionAt} hungry={household.hungrySince !== null} now={now} /><span>Next meal</span></div>
  </div>;
}
