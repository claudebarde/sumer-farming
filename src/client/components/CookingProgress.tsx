import { MEALS, type MealKey } from "../../game-data/kitchen";
import { MEAL_ICONS } from "./mealIcons";
import WorkProgress from "./WorkProgress";

export default function CookingProgress({ job, now }: {
  job: { meal: MealKey; startedAt: string; completesAt: string }; now: number;
}) {
  const start = Date.parse(job.startedAt), end = Date.parse(job.completesAt);
  const approaching = now < start;
  const percentage = Math.floor(Math.max(0, Math.min(100, (now - start) / Math.max(1, end - start) * 100)));
  return <WorkProgress icon={MEAL_ICONS[job.meal]}
    label={approaching ? "Going to the kitchen…" : `Cooking ${MEALS[job.meal].name.toLowerCase()}…`}
    remainingSeconds={Math.max(0, Math.ceil(((approaching ? start : end) - now) / 1000))}
    percentage={percentage} />;
}
