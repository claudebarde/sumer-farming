import { Tooltip } from "radix-ui";
import { MEALS, type MealBenefit } from "../../game-data/kitchen";
import MealIcon from "./MealIcon";
import { useNavigationTooltip } from "./useNavigationTooltip";
import meter from "../styles/HappinessMeter.module.scss";
import styles from "../styles/GameCanvas.module.scss";
import popup from "../styles/IsometricTest.module.scss";

export default function MealBoostMeter({ benefit, now }: { benefit: MealBenefit; now: number }) {
  const tooltip = useNavigationTooltip();
  const remaining = Math.max(0, Math.ceil((benefit.expiresAt - now) / 1000));
  const percentage = Math.max(0, Math.min(100, (now - benefit.startedAt) / Math.max(1, benefit.expiresAt - benefit.startedAt) * 100));
  const minutes = Math.floor(remaining / 60), seconds = remaining % 60;
  const label = `${MEALS[benefit.meal].name}: ${MEALS[benefit.meal].benefit} · ${minutes}m ${seconds}s remaining`;
  return <div>
    <Tooltip.Provider delayDuration={300}><Tooltip.Root {...tooltip("meal-boost")}>
      <Tooltip.Trigger asChild><div className={styles["farmer-meal-boost"]} tabIndex={0} aria-label={label}>
        <MealIcon meal={benefit.meal} size={44} />
        <div className={meter.meter} role="progressbar" aria-label="Meal boost duration"
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage} aria-valuetext={label}>
          <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
            <circle className={meter.track} cx="50" cy="50" r="43" />
            <circle className={meter.fill} cx="50" cy="50" r="43" pathLength={100}
              strokeDasharray="100 100" strokeDashoffset={100 - percentage} transform="rotate(-90 50 50)" />
          </svg>
          <span className={`${meter.value} ${meter.time}`} aria-hidden="true">
            {minutes > 0 && <span>{minutes}m</span>}<span>{seconds}s</span>
          </span>
        </div>
      </div></Tooltip.Trigger>
      <Tooltip.Portal><Tooltip.Content className={popup.navigationTooltip} side="top" sideOffset={6}>
        {MEALS[benefit.meal].name} · {MEALS[benefit.meal].benefit}
        <Tooltip.Arrow className={popup.navigationTooltipArrow} />
      </Tooltip.Content></Tooltip.Portal>
    </Tooltip.Root></Tooltip.Provider>
    <span>Meal boost</span>
  </div>;
}
