import type { FarmSnapshot } from "../../schemas/farm";
import HappinessMeter from "./HappinessMeter";
import RationMeter from "./RationMeter";
import styles from "../styles/GameCanvas.module.scss";

export default function FarmerPopupStatus({ snapshot, now }: { readonly snapshot: FarmSnapshot; readonly now: number }) {
  const household = snapshot.farm.household;
  return <div className={styles["farmer-metrics"]}>
    <div><HappinessMeter value={household.happiness} /><span>Happiness</span></div>
    <div><RationMeter nextRationAt={household.nextBarleyConsumptionAt} hungry={household.hungrySince !== null} now={now} /><span>Next meal</span></div>
  </div>;
}
