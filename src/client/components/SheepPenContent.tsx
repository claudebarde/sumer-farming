import woolIcon from "../../assets/sprite_assets/pngs/v2/isometric-test/sheep/wool-bundle.png";
import { useRef, useState } from "react";
import { z } from "zod";
import { FEED_BARLEY, FEED_GRACE_MS, FEED_PERIOD_MS, PEN_CAPACITY, readySheep, fleeceRemaining, flockFeedDue, sheepStage } from "../../game-data/livestock";
import { FarmSnapshotSchema, type FarmSnapshot } from "../../schemas/farm";
import { INITIAL_FARM_CONFIG } from "../../game-data/initialFarm";
import { farmerSleepBlocker } from "../../game-core/farm/farmerSleep";
import { isFarmerSleeping } from "../../game-data/farmerSleep";
import { farmStore } from "../stores/farmStore";
import { developmentPlayerHeaders } from "../api/developmentPlayer";
import { randomId } from "../randomId";
import { countdownLabel, minuteCountdownLabel } from "./countdownLabel";
import BuildingActionIcon from "./BuildingActionIcon";
import actionStyles from "../styles/BuildingActionButton.module.scss";
import styles from "../styles/SheepPenContent.module.scss";
import meter from "../styles/HappinessMeter.module.scss";
import lamb from "../../assets/sprite_assets/pngs/v2/isometric-test/sheep/sheep-lamb-idle-test.png";
import adult from "../../assets/sprite_assets/pngs/v2/isometric-test/sheep/sheep-adult-idle-test.png";

export default function SheepPenContent({ snapshot, penId, now, getFarmerPosition, onStarted }: {
  snapshot: FarmSnapshot; penId: string; now: number;
  getFarmerPosition?: () => { column: number; row: number } | undefined; onStarted: () => void;
}) {
  const [pending, setPending] = useState(false), [error, setError] = useState<string | null>(null);
  const attempt = useRef<string | null>(null);
  const state = snapshot.farm.production.livestock;
  const animals = state?.animals.filter(a => a.penId === penId) ?? [];
  const due = state && flockFeedDue(state, now);
  const cost = animals.length * FEED_BARLEY;
  const barley = (snapshot.inventory.find(i => i.itemKey === "barley")?.quantity ?? 0) + snapshot.buildings.reduce((total, b) => total + b.storedBarley, 0);
  const blocker = farmerSleepBlocker(snapshot, now);
  const busy = isFarmerSleeping(snapshot.farm.sleep, now) || !!(blocker && blocker !== "No sleep time available yet.");
  const ready = state ? readySheep(state, now) : [];
  const woolRoom = 12 - (snapshot.inventory.find(i => i.itemKey === "wool")?.quantity ?? 0);
  const warehouse = snapshot.buildings.some(b => b.type === "warehouse" && Date.parse(b.completesAt) <= now);
  const feeding = state?.feeding && now < state.feeding.completesAt;
  const act = async (action: "feed" | "shear") => {
    if (pending || busy) return;
    if (action === "feed" ? !due || barley < cost + 1 : !ready.length || due || !warehouse || woolRoom < ready.length * 2) return;
    setPending(true); setError(null);
    const id = attempt.current ?? randomId(); attempt.current = id;
    const position = getFarmerPosition?.() ?? INITIAL_FARM_CONFIG.farmerSpawn;
    try {
      const response = await fetch(`/api/livestock/${action}`, { method: "POST", headers: { ...developmentPlayerHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({
        penId, expectedFarmVersion: snapshot.farm.version, idempotencyKey: id,
        farmerPosition: { column: Math.round(position.column), row: Math.round(position.row) }
      }) });
      const data = await response.json();
      if (!response.ok) { if (response.status < 500) attempt.current = null; throw new Error(z.object({ error: z.object({ message: z.string() }) }).safeParse(data).data?.error.message ?? `Unable to ${action === "feed" ? "feed" : "shear"} the flock.`); }
      farmStore.getState().setReady(FarmSnapshotSchema.parse(data)); attempt.current = null; onStarted();
    } catch (reason) { setError(reason instanceof Error ? reason.message : `Unable to ${action === "feed" ? "feed" : "shear"} the flock.`); }
    finally { setPending(false); }
  };
  const arrived = animals.filter(animal => animal.arrivesAt <= now);
  // Use the earliest deadline if a newly arriving cohort temporarily differs.
  const needsFeedAt = Math.min(...arrived.map(animal => animal.care?.needsFeedAt ?? now));
  const hungry = arrived.length > 0 && !feeding && needsFeedAt <= now;
  const arrivalAt = Math.max(...animals.map(animal => animal.arrivesAt));
  const end = feeding ? state!.feeding!.completesAt : arrived.length === 0 ? arrivalAt : hungry ? needsFeedAt + FEED_GRACE_MS : needsFeedAt;
  const duration = feeding ? state!.feeding!.completesAt - state!.feeding!.startedAt : arrived.length === 0 ? arrivalAt - Math.min(...animals.map(animal => animal.purchasedAt)) : hungry ? FEED_GRACE_MS : FEED_PERIOD_MS;
  const remaining = animals.length ? Math.max(0, end - now) : 0;
  const percentage = animals.length ? Math.max(0, Math.min(100, remaining / Math.max(1, duration) * 100)) : 0;
  const time = remaining < 60_000 ? countdownLabel(remaining) : minuteCountdownLabel(remaining / 60_000);
  const label = feeding ? "Feeding…" : arrived.length === 0 ? "On the way" : hungry ? "Feed within" : "Next feeding";
  return <section aria-label="Flock life cycle">
    <div className={styles.slots} role="list" aria-label="Pen spaces">
      {Array.from({ length: PEN_CAPACITY }, (_, index) => {
        const animal = animals[index];
        const stage = animal ? sheepStage(animal, now) : null;
        return <div key={animal?.id ?? `empty-${index}`} className={styles.slot} role="listitem" aria-label={animal ? `${stage} ${index + 1}` : `Space ${index + 1}: empty`}>
          <span className={styles.animal}>
            <span className={styles.number} aria-hidden="true">{index + 1}</span>
            {animal ? <img src={stage === "Lamb" ? lamb : adult} alt="" /> : <span className={styles.empty} aria-hidden="true" />}
          </span>
          {animal && stage === "Adult" && animal.arrivesAt <= now && <small>{ready.some(a => a.id === animal.id) ? "Wool ready" : "Wool growing"}</small>}
        </div>;
      })}
    </div>
    {animals.length > 0 && <div className={styles.feeding}>
      <span>{label}</span>
      <div className={meter.meter} data-mood={hungry ? "unhappy" : feeding || arrived.length === 0 ? "content" : "happy"}
        role="meter" aria-label={`Flock: ${label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percentage)} aria-valuetext={`${time} remaining`}>
        <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
          <circle className={meter.track} cx="50" cy="50" r="43" />
          <circle className={meter.fill} cx="50" cy="50" r="43" pathLength={100} strokeDasharray="100 100" strokeDashoffset={100 - percentage} transform="rotate(-90 50 50)" />
        </svg>
        <span className={`${meter.value} ${meter.time}`} aria-hidden="true">{time.split(" ").map((part, i) => <span key={i}>{part}</span>)}</span>
      </div>
    </div>}
    {due && <button className={`${actionStyles.button} ${styles.feedButton}`} disabled={pending || busy || barley < cost + 1} onClick={() => void act("feed")}>
      <BuildingActionIcon kind="barley" /><span>{pending ? "Feeding…" : busy ? "The farmer is busy" : barley < cost + 1 ? `Need ${cost} barley + 1 kept for planting` : `Feed flock · ${cost} barley`}</span>
    </button>}
    {ready.length > 0 && <button className={`${actionStyles.button} ${styles.feedButton}`} disabled={pending || busy || !!due || !warehouse || woolRoom < ready.length * 2} onClick={() => void act("shear")}>
      <img src={woolIcon} alt="" width={48} height={48} /><span>{pending ? "Starting…" : busy ? "The farmer is busy" : due ? "Feed flock first" : !warehouse ? "Build a warehouse first" : woolRoom < ready.length * 2 ? `Need space for ${ready.length * 2} wool` : "Shear flock"}</span>
    </button>}
    {state?.fleece && fleeceRemaining(state, now) > 0 && !state.shearing?.settled && state.shearing && now < state.shearing.completesAt ? null : state?.fleece && fleeceRemaining(state, now) > 0 && <small>Wool ready in {minuteCountdownLabel(fleeceRemaining(state, now) / 60000)} of fed time</small>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
