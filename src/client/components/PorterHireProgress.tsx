import type { Porter } from "../../game-data/porter";
import styles from "../styles/ProductionProgress.module.scss";

export default function PorterHireProgress({ porter, now }: { porter: Porter | null | undefined; now: number }) {
  if (!porter) return <p>Hire ended</p>;
  const seconds = Math.max(0, Math.ceil((porter.expiresAt - now) / 1000));
  const countdown = `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const percentage = Math.max(0, Math.min(100, (now - porter.hiredAt) / Math.max(1, porter.expiresAt - porter.hiredAt) * 100));
  return <div className={styles.progress}>
    <div className={styles.labels}><span>Hire time</span><span>{countdown} remaining</span></div>
    <progress aria-label="Porter hire progress" aria-valuetext={`${countdown} remaining`} max={100} value={percentage} />
  </div>;
}
