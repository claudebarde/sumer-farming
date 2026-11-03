import { useRef, useState } from "react";
import type { FarmSnapshot } from "../../schemas/farm";
import type { FarmCoordinate } from "../../game-core/farm/irrigation";
import { gatheringRoom } from "../../game-core/farm/materialGathering";
import type { MaterialGathering } from "../../game-data/materialGathering";
import { RESOURCE_DEFINITIONS } from "../../game-data/resources";
import { FARM_SPRITES } from "../../assets/farmSprites";
import { executeGameCommand } from "../api/gameActions";
import styles from "../styles/IsometricTest.module.scss";
import meter from "../styles/HappinessMeter.module.scss";

const label = (key: "reed" | "clay") => key === "reed" ? "reeds" : "clay";
export function MaterialGatheringProgress({ job, now }: { job: MaterialGathering; now: number }) {
  const completed = Math.min(job.quantity, Math.max(0, Math.floor((now - job.workStartsAt) / RESOURCE_DEFINITIONS[job.itemKey].gatheringDurationMs)));
  const percentage = Math.round(Math.min(100, Math.max(0, (now - job.startedAt) / (job.completesAt - job.startedAt) * 100)));
  const seconds = Math.max(0, Math.ceil((job.completesAt - now) / 1000));
  return <aside className={styles.planting}><div className={styles.sowingProgress}>
    <img className={styles.barleyWorkIcon} src={job.itemKey === "reed" ? FARM_SPRITES.reedBundle : FARM_SPRITES.brickPile} alt="" width={48} height={48} />
    <section><p role="status">{now < job.workStartsAt ? "Walking to collect" : now < job.workEndsAt ? "Collecting" : "Storing"} {label(job.itemKey)}…</p>
      <p>{completed}/{job.quantity} · {seconds >= 60 ? `${Math.floor(seconds / 60)}m ` : ""}{seconds % 60}s remaining</p></section>
    <div className={meter.meter} data-mood="content" role="progressbar" aria-label="Collection and delivery" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}>
      <svg viewBox="0 0 100 100" aria-hidden="true"><circle className={meter.track} cx="50" cy="50" r="43" />
        <circle className={meter.fill} cx="50" cy="50" r="43" pathLength={100} strokeDasharray="100 100" strokeDashoffset={100 - percentage} transform="rotate(-90 50 50)" /></svg>
      <span className={meter.value}>{percentage}%</span>
    </div>
  </div></aside>;
}

export default function MaterialGatheringControls({ snapshot, itemKey, target, now, getFarmerPosition, onStarted, onCancel }: {
  snapshot: FarmSnapshot; itemKey: "reed" | "clay"; target: FarmCoordinate; now: number;
  getFarmerPosition: () => FarmCoordinate | undefined; onStarted: (snapshot: FarmSnapshot) => void; onCancel: () => void;
}) {
  const [selected, setSelected] = useState(1);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const maximum = gatheringRoom(snapshot, itemKey, now);
  const quantity = Math.min(selected, maximum);
  const confirm = async () => {
    if (inFlight.current || quantity < 1) return;
    inFlight.current = true; setPending(true); setError(null);
    try {
      const next = await executeGameCommand({ type: "start_gather_resource", itemKey, target, quantity,
        farmerPosition: getFarmerPosition(), expectedFarmVersion: snapshot.farm.version });
      onStarted(next);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not start collecting."); }
    finally { inFlight.current = false; setPending(false); }
  };
  return <aside className={styles.planting} aria-label={`Collect ${label(itemKey)}`}>
    <p>Collect {label(itemKey)} · {maximum} spaces available</p>
    {error && <p role="alert">{error}</p>}
    <div className={styles.gatheringControls}>
      <div className={styles.gatheringQuantity} role="group" aria-label="Quantity to collect">
        <button aria-label="Decrease quantity" disabled={pending || quantity <= 1} onClick={() => setSelected(quantity - 1)}>−</button>
        <output aria-live="polite">{quantity}</output>
        <button aria-label="Increase quantity" disabled={pending || quantity >= maximum} onClick={() => setSelected(quantity + 1)}>+</button>
      </div>
      <button disabled={pending || quantity < 1} onClick={() => void confirm()}>Collect {label(itemKey)}</button>
      <button disabled={pending} onClick={onCancel}>Cancel</button>
    </div>
  </aside>;
}
