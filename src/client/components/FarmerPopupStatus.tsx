import { activeMeal } from "../../game-data/kitchen";
import MealBoostMeter from "./MealBoostMeter";
import FarmerPointsCounter from "./FarmerPointsCounter";
import type { FarmSnapshot } from "../../schemas/farm";
import HappinessMeter from "./HappinessMeter";
import RationMeter from "./RationMeter";
import styles from "../styles/GameCanvas.module.scss";
export default function FarmerPopupStatus({ snapshot, now }: { readonly snapshot: FarmSnapshot; readonly now: number; readonly walking?: boolean }) {
  const household = snapshot.farm.household;
  const benefit = snapshot.farm.production.mealBenefit;
  const hasBoost = activeMeal(benefit, now) !== null;
  return <div className={`${styles["farmer-metrics"]} ${styles["farmer-popup-metrics"]} ${hasBoost ? styles["farmer-popup-metrics-boost"] : ""}`}>
    <div><HappinessMeter value={household.happiness} /><span>Happiness</span></div>
    <FarmerPointsCounter points={snapshot.player.points ?? 0} />
    {hasBoost && benefit && <MealBoostMeter benefit={benefit} now={now} />}
    <div><RationMeter nextRationAt={household.nextBarleyConsumptionAt} hungry={household.hungrySince !== null} now={now} /><span>Next meal</span></div>
  </div>;
}
