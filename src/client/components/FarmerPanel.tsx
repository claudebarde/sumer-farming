import { farmerProductionJob } from "../../game-core/farm/farmerProduction";
import { useRef, useState } from "react";
import { Popover } from "radix-ui";
import { useStore } from "zustand";
import { farmerCommandStore } from "../stores/farmerCommandStore";
import type { FarmSnapshot } from "../../schemas/farm";
import { fishTreatErrors, getFarmerMood, validateBeerTreat, validateFishTreat } from "../../game-core/farm/wellbeing";
import { BEER_HAPPINESS_BOOST, FISH_HAPPINESS_BOOST, BEER_TREAT_INTERVAL_MS, FISH_TREAT_INTERVAL_MS } from "../../game-data/household";
import { executeGameCommand } from "../api/gameActions";
import { farmStore } from "../stores/farmStore";
import HappinessMeter from "./HappinessMeter";
import RationMeter from "./RationMeter";
import styles from "../styles/GameCanvas.module.scss";
import { breadTreatErrors, validateBreadTreat } from "../../game-core/farm/wellbeing";
import { BREAD_HAPPINESS_BOOST, BREAD_TREAT_INTERVAL_MS } from "../../game-data/household";

export default function FarmerPanel({ snapshot, now }: {
  readonly snapshot: FarmSnapshot;
  readonly now: number;
}) {
  const [pending, setPending] = useState<"fish" | "beer" | "bread" | null>(null);
  const inFlight = useRef(false);
  const [message, setMessage] = useState<{ item: "fish" | "beer" | "bread"; text: string } | null>(null);
  const status = useStore(farmerCommandStore, state => state.status.type);
  const busy = (status !== "idle" && status !== "failed") || !!(
    farmerProductionJob(snapshot.farm) || snapshot.farm.production.planting ||
    snapshot.farm.production.delivery || snapshot.farm.millGoods.delivery ||
    snapshot.farm.fishing || snapshot.farm.gathering ||
    snapshot.farm.carriedItem?.itemKey === "fish" ||
    snapshot.crops.some(crop => crop.harvestStartedAt !== null || Date.parse(crop.plantedAt) > now)
  );
  const household = snapshot.farm.household;
  const mood = getFarmerMood(household.happiness);
  const moodSmiley = { happy: "😄", content: "🙂", unhappy: "🙁" }[mood];
  const level = snapshot.farm.progression?.level ?? 1;
  const giveTreat = async (item: "fish" | "beer" | "bread") => {
    if (inFlight.current || busy) return;
    inFlight.current = true;
    setPending(item);
    setMessage(null);
    try {
      const updated = await executeGameCommand({
        type: item === "fish" ? "give_farmer_fish" : item === "bread" ? "give_farmer_bread" : "give_farmer_beer",
        expectedFarmVersion: snapshot.farm.version
      });
      farmStore.getState().setReady(updated);
      setMessage({ item, text: `The farmer enjoyed ${item === "fish" ? "a fish" : item === "bread" ? "bread" : "a beer"}. Happiness increased!` });
    } catch (error) {
      setMessage({ item, text: error instanceof Error ? error.message : "Could not give the farmer a treat." });
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
    <div className={styles["resource-sections"]}>
      {(["fish", "bread", "beer"] as const).map(item => {
        const quantity = snapshot.inventory.find(entry => entry.itemKey === item)?.quantity ?? 0;
        const unlockLevel = item === "fish" ? 4 : 6;
        const locked = level < unlockLevel;
        const lastAt = item === "fish" ? household.lastFishAt : item === "bread" ? household.lastBreadAt ?? null : household.lastBeerAt;
        const lastTime = lastAt === null ? null : Date.parse(lastAt);
        const interval = item === "fish" ? FISH_TREAT_INTERVAL_MS : item === "bread" ? BREAD_TREAT_INTERVAL_MS : BEER_TREAT_INTERVAL_MS;
        const rule = item === "fish" ? validateFishTreat(quantity, household.happiness, lastTime, now)
          : item === "bread" ? validateBreadTreat(quantity, household.happiness, lastTime, now) : validateBeerTreat(quantity, household.happiness, lastTime, now);
        const remainingMinutes = lastTime === null ? 0 : Math.max(0, Math.ceil((lastTime + interval - now) / 60000));
        const reason = locked ? `Unlocks at farm level ${unlockLevel}.` : rule === null ? null
          : { ...fishTreatErrors, ...breadTreatErrors }[rule];
        const button = <button disabled={locked || pending !== null || rule !== null}
          aria-disabled={busy || undefined}
          onClick={() => { void giveTreat(item); }}>
          {pending === item ? "Giving treat…" : remainingMinutes > 0 && !locked
            ? `Wait ${Math.floor(remainingMinutes / 60)}h ${remainingMinutes % 60}m`
            : item === "fish" && quantity === 0 ? "No fish available"
            : `Give one ${item} to the farmer`}
        </button>;
        return <section key={item} data-locked={locked ? "true" : undefined}>
          <h3>{item === "fish" ? "Fish treat" : item === "bread" ? "Bread treat" : "Beer treat"}</h3>
          <p>{item === "fish" ? "Stored fish" : item === "bread" ? "Stored bread" : "Filled beer jars"}: {quantity}</p>
          <p>+{item === "fish" ? FISH_HAPPINESS_BOOST : item === "bread" ? BREAD_HAPPINESS_BOOST : BEER_HAPPINESS_BOOST} happiness · One {item} every {interval / 3600000} hours.</p>
          {reason && <p>{reason}</p>}
          {message?.item === item && <p role="status">{message.text}</p>}
          {busy ? <Popover.Root>
            <Popover.Trigger asChild>{button}</Popover.Trigger>
            <Popover.Portal>
              <Popover.Content className={styles["farmer-busy-popover"]} side="top" sideOffset={8}
                collisionPadding={12} aria-label="Farmer availability">
                The farmer is busy
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root> : button}
        </section>;
      })}
    </div>
  </>;
}
