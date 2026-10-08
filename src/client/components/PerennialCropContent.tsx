import { useRef, useState } from "react";
import { CROP_DEFINITIONS, type PerennialCropKey } from "../../game-data/crops";
import { perennialActionReason } from "../../game-core/farm/perennialCrops";
import { FARM_SPRITES } from "../../assets/farmSprites";
import type { FarmSnapshot } from "../../schemas/farm";
import type { FarmCoordinate } from "../../game-core/farm/irrigation";
import { executeGameCommand } from "../api/gameActions";
import { farmStore } from "../stores/farmStore";
import { workerLocationStore } from "../stores/workerLocationStore";
import TileActionButton from "./TileActionButton";
import styles from "../styles/GameCanvas.module.scss";

export function PerennialCropAction({ snapshot, cropKey, target, now, action }: {
  snapshot: FarmSnapshot; cropKey: PerennialCropKey; target: FarmCoordinate; now: number; action: "plant" | "harvest";
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const definition = CROP_DEFINITIONS[cropKey];
  const reason = perennialActionReason(snapshot, cropKey, target, action, now);
  const submit = async () => {
    if (inFlight.current || reason) return;
    inFlight.current = true; setPending(true); setError(null);
    try {
      farmStore.getState().setReady(await executeGameCommand({ type: "tend_perennial_crop", crop: cropKey, action, target,
        farmerPosition: workerLocationStore.getState().farmerPosition, expectedFarmVersion: snapshot.farm.version }));
    } catch (e) { setError(e instanceof Error ? e.message : "Could not tend the crop."); }
    finally { inFlight.current = false; setPending(false); }
  };
  return <>
    {error && <p role="alert">{error}</p>}
    <TileActionButton disabled={pending || reason !== null} onClick={() => void submit()}>
      {pending ? "Starting…" : reason ?? (action === "plant" ? `Plant ${definition.label.toLowerCase()} · ${definition.saplingCost} shekels` : "Harvest dates")}
    </TileActionButton>
  </>;
}

export default function PerennialCropContent({ snapshot, target, now }: { snapshot: FarmSnapshot; target: FarmCoordinate; now: number }) {
  const crop = snapshot.crops.find(c => c.column === target.column && c.row === target.row);
  if (!crop || crop.cropKey !== "datePalm") return null;
  const definition = CROP_DEFINITIONS[crop.cropKey];
  const matureAt = Date.parse(crop.plantedAt) + definition.growthDurationMs;
  const readyAt = Date.parse(crop.growthCompletesAt);
  const young = now < matureAt;
  const deadline = young ? matureAt : readyAt;
  const ready = now >= readyAt;
  const duration = young ? definition.growthDurationMs : definition.ripeningDurationMs;
  const minutes = Math.max(0, Math.ceil((deadline - now) / 60000));
  return <div className={styles["tile-popover-content"]}>
    <div className={styles["tile-popover-content-header"]}>{definition.label}</div>
    <div className={styles["tile-popover-content-body"]}>
      <span>{ready && <img src={FARM_SPRITES.datesBasket} alt="" width={32} height={32} />} {ready ? `${definition.harvestYield} baskets of dates ready to harvest.` : young ? "This sapling is growing into a date palm." : "The next dates are ripening."}</span>
      {!ready && <><span>{Math.floor(minutes / 60)}h {minutes % 60}m remaining</span>
        <progress max={100} value={Math.max(0, Math.min(100, 100 * (1 - (deadline - now) / duration)))} aria-label={young ? "Palm maturity" : "Dates ripening"} /></>}
      <span>Dates ripen every 12 hours after a full harvest. Ripe fruit waits on the palm until collected.</span>
      {ready && <><span>Harvest one palm at a time. The warehouse must have room for both baskets before harvesting can start.</span>
        <PerennialCropAction snapshot={snapshot} cropKey={crop.cropKey} target={target} now={now} action="harvest" /></>}
    </div>
  </div>;
}
