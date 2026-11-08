import type { ReactNode } from "react";
import meter from "../styles/HappinessMeter.module.scss";
import styles from "../styles/IsometricTest.module.scss";

/** Shared harvesting-style action status: icon, details, circular progress. */
export default function WorkProgress({ icon, label, details, remainingSeconds, percentage }: {
  icon: string; label: string; details?: ReactNode; remainingSeconds: number; percentage: number;
}) {
  return <div className={styles.sowingProgress}>
    <img className={styles.barleyWorkIcon} src={icon} alt="" width={48} height={48} />
    <section><p role="status">{label}</p>{details}<p>{remainingSeconds}s remaining</p></section>
    <div className={meter.meter} data-mood="content" role="progressbar" aria-label={label}
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}>
      <svg viewBox="0 0 100 100" aria-hidden="true"><circle className={meter.track} cx="50" cy="50" r="43" />
        <circle className={meter.fill} cx="50" cy="50" r="43" pathLength={100} strokeDasharray="100 100"
          strokeDashoffset={100 - percentage} transform="rotate(-90 50 50)" /></svg>
      <span className={meter.value} aria-hidden="true">{percentage}%</span>
    </div>
  </div>;
}
