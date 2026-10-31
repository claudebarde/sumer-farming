import styles from "../styles/ProductionProgress.module.scss";
import { countdownLabel } from "./countdownLabel";

export default function ProductionProgress({ job, now, label, countdownPrefix }: {
  readonly job: { readonly startedAt: string; readonly completesAt: string };
  readonly now: number;
  readonly label: string;
  readonly countdownPrefix?: string;
}) {
  const start = Date.parse(job.startedAt), end = Date.parse(job.completesAt);
  const percentage = Math.max(0, Math.min(100, (now - start) / Math.max(1, end - start) * 100));
  const countdown = countdownLabel(end - now);
  return <div className={styles.progress}>
    <div className={styles.labels}><span>{Math.floor(percentage)}%</span><span>{countdownPrefix ? `${countdownPrefix} ${countdown}` : `${countdown} remaining`}</span></div>
    <progress aria-label={label} max={100} value={percentage} />
  </div>;
}
