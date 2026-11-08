import type { MealKey } from "../../game-data/kitchen";
import { MEAL_ICONS } from "./mealIcons";
import styles from "../styles/Kitchen.module.scss";

/** Decorative beside the meal name or benefit text. */
export default function MealIcon({ meal, size = 64 }: { readonly meal: MealKey; readonly size?: number }) {
  return <img className={styles.mealIcon} src={MEAL_ICONS[meal]} width={size} height={size} alt="" draggable={false} />;
}
