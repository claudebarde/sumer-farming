import type { FarmSnapshot } from "../../schemas/farm";
import { activeMeal, MEALS, MEAL_KEYS, type MealKey } from "../../game-data/kitchen";
import { farmerSleepBlocker } from "../../game-core/farm/farmerSleep";
import BuildingActionIcon from "./BuildingActionIcon";
import MealIcon from "./MealIcon";
import ProductionProgress from "./ProductionProgress";
import { countdownLabel } from "./countdownLabel";
import styles from "../styles/Kitchen.module.scss";

export function MealBenefitStatus({ snapshot, now }: { snapshot: FarmSnapshot; now: number }) {
  const benefit = snapshot.farm.production.mealBenefit;
  const meal = activeMeal(benefit, now);
  return meal && benefit ? <p className={styles.benefit} role="status"><MealIcon meal={meal} size={48} /><span>{MEALS[meal].benefit} · {countdownLabel(benefit.expiresAt - now)}</span></p> : null;
}
export default function KitchenContent({ snapshot, now, onCook, pending }: { pending?: boolean; snapshot: FarmSnapshot; now: number; onCook: (meal: MealKey) => void }) {
  const job = snapshot.farm.production.cooking;
  const reason = farmerSleepBlocker(snapshot, now);
  const busy = reason !== null && reason !== "No sleep time available yet.";
  return <div className={styles.kitchen}>
    <MealBenefitStatus snapshot={snapshot} now={now} />
    {job ? <><p className={styles.mealHeading}><MealIcon meal={job.meal} />{MEALS[job.meal].name}</p><ProductionProgress job={job} now={now} label="Cooking progress" /></> : <>
      {busy && <p role="status">The farmer is busy.</p>}
      {activeMeal(snapshot.farm.production.mealBenefit, now) && <p>Replaces your current meal benefit when eaten.</p>}
      {MEAL_KEYS.map(key => {
        const meal = MEALS[key], ingredients = Object.entries(meal.ingredients);
        const enough = ingredients.every(([item, amount]) => (snapshot.inventory.find(i => i.itemKey === item)?.quantity ?? 0) >= amount);
        return <div className={styles.recipe} key={key}>
          <div className={styles.mealHeading}><MealIcon meal={key} /><div><strong>{meal.name}</strong><small>{meal.benefit} · {meal.durationMs / 60_000} min</small></div></div>
          <div className={styles.ingredients}>{ingredients.map(([item, amount]) => <span key={item} aria-label={`${amount} ${item}`}><BuildingActionIcon kind={item === "brewersGroats" ? "groats" : item as "flour" | "oil" | "dates" | "sesame"} />{amount}</span>)}</div>
          <button disabled={pending || busy || !enough} onClick={() => onCook(key)}>Cook · 30s</button>
        </div>;
      })}
    </>}
  </div>;
}
