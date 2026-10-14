import meter from "../styles/HappinessMeter.module.scss";
import styles from "../styles/IsometricTest.module.scss";

export default function BarleyWorkProgress({ action, total, progress, delivering = false }: {
  readonly action: "Sowing" | "Harvesting";
  readonly total: number;
  readonly progress: { readonly completed: number; readonly totalMs: number; readonly percentage: number };
  readonly delivering?: boolean;
}) {
  const { completed, totalMs, percentage } = progress;
  return <div className={styles.sowingProgress}>
    <section>
      <p role="status">{delivering ? "Storing barley..." : `${action} barley...`}</p>
      <p>{completed}/{total} fields</p>
    </section>
    <div className={meter.meter} data-mood="content" role="progressbar" aria-label={`${action} barley`}
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}
      aria-valuetext={`${percentage}% · ${completed}/${total} fields`}
      title={`${totalMs / 1000}s ${action.toLowerCase()} time, excluding travel`}>
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <circle className={meter.track} cx="50" cy="50" r="43" />
        <circle className={meter.fill} cx="50" cy="50" r="43" pathLength={100}
          strokeDasharray="100 100" strokeDashoffset={100 - percentage} transform="rotate(-90 50 50)" />
      </svg>
      <span className={meter.value} aria-hidden="true">{percentage}%</span>
    </div>
  </div>;
}
