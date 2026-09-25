import { BARLEY_CONSUMPTION_INTERVAL_MS } from "../../game-data/household";
import styles from "../styles/HappinessMeter.module.scss";

type Props = {
  readonly nextRationAt: string | null;
  readonly hungry: boolean;
  readonly now: number;
};

export default function RationMeter({ nextRationAt, hungry, now }: Props) {
  const inactive = nextRationAt === null && !hungry;
  const remaining = hungry || nextRationAt === null ? 0 : Math.max(0, Date.parse(nextRationAt) - now);
  const percentage = Math.min(100, remaining / BARLEY_CONSUMPTION_INTERVAL_MS * 100);
  const minutes = Math.ceil(remaining / 60000);
  const hours = Math.floor(minutes / 60);
  const label = inactive ? "Automatic feeding begins after cultivation starts" :
    hungry ? "Hungry: a ration is needed now" :
      remaining === 0 ? "Ration due now" : `Next ration in ${hours} hours and ${minutes % 60} minutes`;

  return (
    <div className={styles.meter} data-mood={percentage >= 50 ? "happy" : percentage > 0 ? "content" : "unhappy"}
      role="meter" aria-label="Time until next ration" aria-valuemin={0} aria-valuemax={100}
      aria-valuenow={percentage} aria-valuetext={label} title={label}>
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <circle className={styles.track} cx="50" cy="50" r="43" />
        <circle className={styles.fill} cx="50" cy="50" r="43" pathLength={100}
          strokeDasharray="100 100" strokeDashoffset={100 - percentage} transform="rotate(-90 50 50)" />
      </svg>
      <span className={`${styles.value} ${styles.time}`} aria-hidden="true">
        {inactive ? "—" : remaining === 0 ? "Due" : (
          <><span>{hours}h</span><span>{minutes % 60}m</span></>
        )}
      </span>
    </div>
  );
}
