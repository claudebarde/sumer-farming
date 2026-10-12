import type { BatchPlanting } from "../../game-data/batchPlanting";
import { sowingProgress } from "../game/phaser/isometricPlanting";
import meter from "../styles/HappinessMeter.module.scss";
import styles from "../styles/IsometricTest.module.scss";

export default function SowingProgress({ batch, now }: { readonly batch: BatchPlanting; readonly now: number }) {
  const { completed, totalMs, percentage } = sowingProgress(batch, now);
  return <div className={styles.sowingProgress}>
    <section>
      <p role="status">Sowing barley...</p>
      <p>{completed}/{batch.total} fields</p>
    </section>
    <div className={meter.meter} data-mood="content" role="progressbar" aria-label="Sowing barley"
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}
      aria-valuetext={`${percentage}% · ${completed}/${batch.total} fields`}
      title={`${totalMs / 1000}s sowing time, excluding travel`}>
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <circle className={meter.track} cx="50" cy="50" r="43" />
        <circle className={meter.fill} cx="50" cy="50" r="43" pathLength={100}
          strokeDasharray="100 100" strokeDashoffset={100 - percentage} transform="rotate(-90 50 50)" />
      </svg>
      <span className={meter.value} aria-hidden="true">{percentage}%</span>
    </div>
  </div>;
}
