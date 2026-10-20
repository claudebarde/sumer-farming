import styles from "../styles/ProductionProgress.module.scss";

export default function ProductionProgress({ job, now, label }: {
  readonly job: { readonly startedAt: string; readonly completesAt: string };
  readonly now: number;
  readonly label: string;
}) {
  const start = Date.parse(job.startedAt), end = Date.parse(job.completesAt);
  const percentage = Math.max(0, Math.min(100, (now - start) / Math.max(1, end - start) * 100));
  const seconds = Math.max(0, Math.ceil((end - now) / 1000));
  const countdown = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  return <div className={styles.progress}>
    <div className={styles.labels}><span>{Math.floor(percentage)}%</span><span>{countdown} remaining</span></div>
    <progress aria-label={label} max={100} value={percentage} />
  </div>;
}
