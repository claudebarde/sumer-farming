import { getFarmerMood } from "../../game-core/farm/wellbeing";
import styles from "../styles/HappinessMeter.module.scss";

export default function HappinessMeter({ value }: { readonly value: number }) {
  const percentage = Number.isFinite(value) ? Math.round(Math.min(100, Math.max(0, value))) : 0;
  const mood = getFarmerMood(percentage);

  return (
    <div
      className={styles.meter}
      data-mood={mood}
      role="meter"
      aria-label="Farmer happiness"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percentage}
      aria-valuetext={`${percentage}% — ${mood}`}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <circle className={styles.track} cx="50" cy="50" r="43" />
        <circle
          className={styles.fill}
          cx="50" cy="50" r="43"
          pathLength={100}
          strokeDasharray="100 100"
          strokeDashoffset={100 - percentage}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <span className={styles.value} aria-hidden="true">{percentage}%</span>
    </div>
  );
}
