import FarmerPointsCounter from "./FarmerPointsCounter";
import { farmerProductionJob } from "../../game-core/farm/farmerProduction";
import { cropWorkActive } from "../../game-core/farm/perennialCrops";
import { datesTreatErrors, validateDatesTreat } from "../../game-core/farm/wellbeing";
import { DATES_HAPPINESS_BOOST, DATES_TREAT_INTERVAL_MS } from "../../game-data/household";
import { shrineBlessingActive } from "../../game-data/shrine";
import { useRef, useState } from "react";
import { Popover } from "radix-ui";
import { useStore } from "zustand";
import { farmerCommandStore } from "../stores/farmerCommandStore";
import type { FarmSnapshot } from "../../schemas/farm";
import {
  fishTreatErrors,
  validateBeerTreat,
  validateFishTreat
} from "../../game-core/farm/wellbeing";
import {
  BEER_HAPPINESS_BOOST,
  FISH_HAPPINESS_BOOST,
  BEER_TREAT_INTERVAL_MS,
  FISH_TREAT_INTERVAL_MS
} from "../../game-data/household";
import { executeGameCommand } from "../api/gameActions";
import { farmStore } from "../stores/farmStore";
import HappinessMeter from "./HappinessMeter";
import RationMeter from "./RationMeter";
import FarmerPortrait from "./FarmerPortrait";
import styles from "../styles/GameCanvas.module.scss";
import treatStyles from "../styles/FarmerTreats.module.scss";
import { FARM_SPRITES } from "../../assets/farmSprites";
import datesIcon from "../../assets/sprite_assets/pngs/v2/isometric-test/date-palms/baskets-dates.webp";
import breadIcon from "../../assets/sprite_assets/pngs/v2/isometric-test/bread-oven-active/bread-basket-isometric.webp";
import beerIcon from "../../assets/sprite_assets/pngs/v2/isometric-test/brewery/beer-jars-full-isometric.webp";
import {
  breadTreatErrors,
  validateBreadTreat
} from "../../game-core/farm/wellbeing";
import {
  BREAD_HAPPINESS_BOOST,
  BREAD_TREAT_INTERVAL_MS
} from "../../game-data/household";

export default function FarmerPanel({
  snapshot,
  now
}: {
  readonly snapshot: FarmSnapshot;
  readonly now: number;
}) {
  const [pending, setPending] = useState<"fish" | "beer" | "bread" | "dates" | null>(
    null
  );
  const inFlight = useRef(false);
  const [message, setMessage] = useState<{
    item: "fish" | "beer" | "bread" | "dates";
    text: string;
  } | null>(null);
  const status = useStore(farmerCommandStore, state => state.status.type);
  const busy =
    (status !== "idle" && status !== "failed") ||
    !!(
      farmerProductionJob(snapshot.farm) ||
      cropWorkActive(snapshot) ||
      snapshot.farm.production.planting ||
      snapshot.farm.production.materialDelivery ||
      snapshot.farm.production.delivery ||
      snapshot.farm.millGoods.delivery ||
      snapshot.farm.fishing ||
      snapshot.farm.gathering ||
      snapshot.farm.carriedItem?.itemKey === "fish" ||
      snapshot.crops.some(
        crop =>
          crop.harvestStartedAt !== null || Date.parse(crop.plantedAt) > now
      )
    );
  const household = snapshot.farm.household;
  const blessing = snapshot.farm.production.shrineBlessing;
  const blessed = shrineBlessingActive(blessing, now);
  const blessingMinutes = blessed
    ? Math.ceil((Date.parse(blessing!.expiresAt) - now) / 60000)
    : 0;
  const level = snapshot.farm.progression?.level ?? 1;
  const giveTreat = async (item: "fish" | "beer" | "bread" | "dates") => {
    if (inFlight.current || busy) return;
    inFlight.current = true;
    setPending(item);
    setMessage(null);
    try {
      const updated = await executeGameCommand({
        type:
          item === "dates" ? "give_farmer_dates" : item === "fish"
            ? "give_farmer_fish"
            : item === "bread"
              ? "give_farmer_bread"
              : "give_farmer_beer",
        expectedFarmVersion: snapshot.farm.version
      });
      farmStore.getState().setReady(updated);
      setMessage({
        item,
        text: `The farmer enjoyed ${item === "dates" ? "dates" : item === "fish" ? "a fish" : item === "bread" ? "bread" : "a beer"}. Happiness increased!`
      });
    } catch (error) {
      setMessage({
        item,
        text:
          error instanceof Error
            ? error.message
            : "Could not give the farmer a treat."
      });
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  };

  return (
    <>
      <h2 className={styles["farmer-heading"]}>
        {snapshot.farm.farmerProfile?.identity.name ?? "Farmer"}
      </h2>
      <FarmerPortrait
        name={snapshot.farm.farmerProfile?.identity.name ?? "Farmer"}
      />
      <div className={`${styles["farmer-metrics"]} ${styles["farmer-score-metrics"]}`}>
        <div>
          <HappinessMeter value={household.happiness} />
          <span>Happiness</span>
        </div>
        <FarmerPointsCounter points={snapshot.player.points ?? 0} />
        <div>
          <RationMeter
            nextRationAt={household.nextBarleyConsumptionAt}
            hungry={household.hungrySince !== null}
            now={now}
          />
          <span>Next meal</span>
        </div>
      </div>
      {household.hungrySince !== null && (
        <p>Your farmer is hungry. Store barley in the farm or a completed granary so he can eat.</p>
      )}
      {level < 4 && (
        <p>
          Happiness is protected during the first three levels. Fish treats
          unlock at level 4.
        </p>
      )}
      {blessed && (
        <p>
          Shrine blessing: 25% slower happiness decay ·{" "}
          {Math.floor(blessingMinutes / 60)}h {blessingMinutes % 60}m remaining.
        </p>
      )}
      <div className={`${styles["resource-sections"]} ${treatStyles.list}`}>
        {(["fish", "bread", "beer", "dates"] as const).filter(item => item !== "dates" || level >= 9).map(item => {
          const quantity =
            snapshot.inventory.find(entry => entry.itemKey === item)
              ?.quantity ?? 0;
          const unlockLevel = item === "dates" ? 9 : item === "fish" ? 4 : 6;
          const locked = level < unlockLevel;
          const lastAt =
            item === "dates" ? snapshot.farm.production.lastDatesAt ?? null : item === "fish"
              ? household.lastFishAt
              : item === "bread"
                ? (household.lastBreadAt ?? null)
                : household.lastBeerAt;
          const lastTime = lastAt === null ? null : Date.parse(lastAt);
          const interval =
            item === "dates" ? DATES_TREAT_INTERVAL_MS : item === "fish"
              ? FISH_TREAT_INTERVAL_MS
              : item === "bread"
                ? BREAD_TREAT_INTERVAL_MS
                : BEER_TREAT_INTERVAL_MS;
          const rule =
            item === "dates" ? validateDatesTreat(quantity, household.happiness, lastTime, now) : item === "fish"
              ? validateFishTreat(quantity, household.happiness, lastTime, now)
              : item === "bread"
                ? validateBreadTreat(
                    quantity,
                    household.happiness,
                    lastTime,
                    now
                  )
                : validateBeerTreat(
                    quantity,
                    household.happiness,
                    lastTime,
                    now
                  );
          const remainingMinutes =
            lastTime === null
              ? 0
              : Math.max(0, Math.ceil((lastTime + interval - now) / 60000));
          const reason = locked
            ? `Unlocks at farm level ${unlockLevel}.`
            : rule === null
              ? null
              : { ...fishTreatErrors, ...breadTreatErrors, ...datesTreatErrors }[rule];
          const button = (
            <button
              aria-label={!locked && pending === null && remainingMinutes === 0 && quantity > 0 ? (item === "dates" ? "Give one basket of dates" : `Give one ${item} to the farmer`) : undefined}
              disabled={locked || pending !== null || rule !== null}
              aria-disabled={busy || undefined}
              onClick={() => {
                void giveTreat(item);
              }}
            >
              {pending === item
                ? "Giving treat…"
                : remainingMinutes > 0 && !locked
                  ? `Wait ${Math.floor(remainingMinutes / 60)}h ${remainingMinutes % 60}m`
                  : item === "dates" ? "Give one basket of dates" : `Give ${item}`}
            </button>
          );
          const action = busy ? (
            <Popover.Root>
              <Popover.Trigger asChild>{button}</Popover.Trigger>
              <Popover.Portal>
                <Popover.Content className={styles["farmer-busy-popover"]} side="top" sideOffset={8} collisionPadding={12} aria-label="Farmer availability">
                  The farmer is busy
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          ) : button;
          {
            const boost = item === "dates" ? DATES_HAPPINESS_BOOST : item === "fish" ? FISH_HAPPINESS_BOOST : item === "bread" ? BREAD_HAPPINESS_BOOST : BEER_HAPPINESS_BOOST;
            const name = item === "dates" ? "Dates" : item === "fish" ? "Fish" : item === "bread" ? "Bread" : "Beer";
            return <section key={item} className={treatStyles.card} data-locked={locked ? "true" : undefined} aria-label={`${name} treat`}>
              <div className={treatStyles.resource}>
                <div className={treatStyles.artwork}>
                  <img src={item === "dates" ? datesIcon : item === "fish" ? FARM_SPRITES.fish : item === "bread" ? breadIcon : beerIcon} alt="" width={56} height={56} />
                </div>
                <strong>{name}</strong>
                {quantity === 0 && <small className={treatStyles.unavailable}>No {item} available</small>}
              </div>
              <div className={treatStyles.benefit}>
                <strong aria-label={`+${boost} happiness`}><span aria-hidden="true">♥ +{boost}</span></strong>
                <span aria-hidden="true">Happiness</span>
                <small>Every {interval / 3600000}h</small>
              </div>
              <div className={treatStyles.action}>
                {remainingMinutes > 0 && !locked && <small>Ready in</small>}
                {reason && (locked || remainingMinutes === 0) && (locked || !rule?.startsWith("no_")) && <small>{reason}</small>}
                {action}
              </div>
              {message?.item === item && <p className={treatStyles.message} role="status">{message.text}</p>}
            </section>;
          }
        })}
      </div>
    </>
  );
}
