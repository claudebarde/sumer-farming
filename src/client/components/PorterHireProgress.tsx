import type { Porter } from "../../game-data/porter";
import styles from "../styles/ProductionProgress.module.scss";
import { countdownLabel } from "./countdownLabel";

export default function PorterHireProgress({ porter, now }: { porter: Porter | null | undefined; now: number }) {
  if (!porter) return <p>Hire ended</p>;
  const countdown = countdownLabel(porter.expiresAt - now);
  const percentage = Math.max(0, Math.min(100, (now - porter.hiredAt) / Math.max(1, porter.expiresAt - porter.hiredAt) * 100));
  return <div className={styles.progress}>
    <div className={styles.labels}><span>Hire time</span><span>{countdown} remaining</span></div>
    <progress aria-label="Porter hire progress" aria-valuetext={`${countdown} remaining`} max={100} value={percentage} />
  </div>;
}
