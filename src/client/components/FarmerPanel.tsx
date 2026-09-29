import { useRef, useState } from "react";
import type { FarmSnapshot } from "../../schemas/farm";
import { fishTreatErrors, getFarmerMood, validateBeerTreat, validateFishTreat } from "../../game-core/farm/wellbeing";
import { BEER_HAPPINESS_BOOST, FISH_HAPPINESS_BOOST, BEER_TREAT_INTERVAL_MS, FISH_TREAT_INTERVAL_MS } from "../../game-data/household";
import { executeGameCommand } from "../api/gameActions";
import { farmStore } from "../stores/farmStore";
import HappinessMeter from "./HappinessMeter";
import RationMeter from "./RationMeter";
import styles from "../styles/GameCanvas.module.scss";

export default function FarmerPanel({ snapshot, now }: {
  readonly snapshot: FarmSnapshot;
  readonly now: number;
}) {
  const [pending, setPending] = useState<"fish" | "beer" | null>(null);
  const inFlight = useRef(false);
  const [message, setMessage] = useState<string | null>(null);
  const household = snapshot.farm.household;
  const mood = getFarmerMood(household.happiness);
  const moodSmiley = { happy: "😄", content: "🙂", unhappy: "🙁" }[mood];
  const level = snapshot.farm.progression?.level ?? 1;
  const giveTreat = async (item: "fish" | "beer") => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(item);
    setMessage(null);
    try {
      const updated = await executeGameCommand({
        type: item === "fish" ? "give_farmer_fish" : "give_farmer_beer",
        expectedFarmVersion: snapshot.farm.version
      });
      farmStore.getState().setReady(updated);
      setMessage(`The farmer enjoyed ${item === "fish" ? "a fish" : "a beer"}. Happiness increased!`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not give the farmer a treat.");
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  };

  return <>
    <h2 className={styles["farmer-heading"]}>
      Farmer
      <span role="img" aria-label={`Farmer mood: ${mood}`} title={`Mood: ${mood}`}>
        {moodSmiley}
      </span>
    </h2>
    <div className={styles["farmer-metrics"]}>
      <div><HappinessMeter value={household.happiness} /><span>Happiness</span></div>
      <div><RationMeter nextRationAt={household.nextBarleyConsumptionAt} hungry={household.hungrySince !== null} now={now} /><span>Next meal</span></div>
    </div>
    <p>{household.hungrySince !== null
      ? "Your farmer is hungry. Store barley in the farm or a completed granary so he can eat."
      : "Meals use stored barley automatically. Keep barley in the farm or a completed granary."}</p>
    {level < 4 && <p>Happiness is protected during the first three levels. Fish treats unlock at level 4.</p>}
    {message && <p role="status">{message}</p>}
    <div className={styles["resource-sections"]}>
      {(["fish", "beer"] as const).map(item => {
        const quantity = snapshot.inventory.find(entry => entry.itemKey === item)?.quantity ?? 0;
        const unlockLevel = item === "fish" ? 4 : 6;
        const locked = level < unlockLevel;
        const lastAt = item === "fish" ? household.lastFishAt : household.lastBeerAt;
        const lastTime = lastAt === null ? null : Date.parse(lastAt);
        const interval = item === "fish" ? FISH_TREAT_INTERVAL_MS : BEER_TREAT_INTERVAL_MS;
        const rule = item === "fish" ? validateFishTreat(quantity, household.happiness, lastTime, now)
          : validateBeerTreat(quantity, household.happiness, lastTime, now);
        const remainingMinutes = lastTime === null ? 0 : Math.max(0, Math.ceil((lastTime + interval - now) / 60000));
        const reason = snapshot.farm.milling ? "The farmer is working in the Mill." : locked ? `Unlocks at farm level ${unlockLevel}.` : rule === null ? null
          : fishTreatErrors[rule];
        return <section key={item} data-locked={locked ? "true" : undefined}>
          <h3>{item === "fish" ? "Fish treat" : "Beer treat"}</h3>
          <p>{item === "fish" ? "Stored fish" : "Filled beer jars"}: {quantity}</p>
          <p>+{item === "fish" ? FISH_HAPPINESS_BOOST : BEER_HAPPINESS_BOOST} happiness · One {item} every {interval / 3600000} hours.</p>
          {reason && <p>{reason}</p>}
          <button disabled={!!snapshot.farm.milling || locked || pending !== null || rule !== null} onClick={() => { void giveTreat(item); }}>
            {pending === item ? "Giving treat…" : remainingMinutes > 0 && !locked
              ? `Wait ${Math.floor(remainingMinutes / 60)}h ${remainingMinutes % 60}m`
              : `Give one ${item} to the farmer`}
          </button>
        </section>;
      })}
    </div>
  </>;
}
