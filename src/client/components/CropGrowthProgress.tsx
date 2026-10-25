import styles from "../styles/ProductionProgress.module.scss";

export default function CropGrowthProgress({ percentage, remainingMs, label }: {
  percentage: number; remainingMs: number; label: string;
}) {
  const value = Math.max(0, Math.min(100, percentage));
  const minutes = Math.max(0, Math.ceil(remainingMs / 60000));
  return <div className={styles.progress}>
    <div className={styles.labels}><span>{Math.floor(value)}%</span>
      <span>{minutes >= 60 && `${Math.floor(minutes / 60)}h `}{minutes % 60}m remaining</span></div>
    <progress max={100} value={value} aria-label={label} />
  </div>;
}
