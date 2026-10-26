import type { FarmSnapshot } from "../../schemas/farm";
import { shrineBlessingActive } from "../../game-data/shrine";
import { shrineOfferingBlocker } from "../game/phaser/isometricShrine";
import { plantingBlocker } from "../game/phaser/isometricPlanting";
import BuildingActionIcon from "./BuildingActionIcon";
import styles from "../styles/BuildingActionButton.module.scss";
import InfoAlert from "./InfoAlert";
import beer from "../../assets/sprite_assets/pngs/v2/isometric-test/brewery/beer-jars-full-isometric.webp";
import progressStyles from "../styles/ProductionProgress.module.scss";
import { countdownLabel } from "./countdownLabel";

export default function IsometricShrineActions({ snapshot, buildingId, now, onOffer }: {
  snapshot: FarmSnapshot; buildingId: string; now: number; onOffer?: (item: "bread" | "beer") => void;
}) {
  const blessing = snapshot.farm.production.shrineBlessing;
  const active = shrineBlessingActive(blessing, now);
  if (active && blessing) {
    const remaining = Math.max(0, Date.parse(blessing.expiresAt) - now);
    const duration = Math.max(1, Date.parse(blessing.expiresAt) - Date.parse(blessing.startedAt));
    const percentage = Math.max(0, Math.min(100, (now - Date.parse(blessing.startedAt)) / duration * 100));
    const countdown = countdownLabel(remaining);
    return <div className={progressStyles.progress}>
      <div className={progressStyles.labels}><span>Blessing</span><span>{countdown} remaining</span></div>
      <progress aria-label="Blessing progress" aria-valuetext={`${countdown} remaining`} max={100} value={percentage} />
    </div>;
  }
  // Carrying goods alone is not work; keep its separate empty-hands explanation.
  const busy = plantingBlocker({ ...snapshot, farm: { ...snapshot.farm, carriedItem: null } }, now) !== null;
  return <>
    {busy ? <InfoAlert role="alert">The farmer is busy</InfoAlert> : (["bread", "beer"] as const).map(item => {
      const reason = shrineOfferingBlocker(snapshot, buildingId, item, now);
      return <div key={item}>
        <button className={styles.button} style={{ width: "100%" }} disabled={!onOffer || !!reason} onClick={() => onOffer?.(item)}>
          {item === "bread" ? <BuildingActionIcon kind="bread" /> : <span className={styles.icon} aria-hidden="true"><img src={beer} alt="" /></span>}
          <span>Offer 2 {item}</span>
        </button>
        {reason && <p>{reason}</p>}
      </div>;
    })}
  </>;
}
