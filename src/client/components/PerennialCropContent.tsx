import { useRef, useState } from "react";
import { CROP_DEFINITIONS, type PerennialCropKey } from "../../game-data/crops";
import { perennialActionReason } from "../../game-core/farm/perennialCrops";
import datesIcon from "../../assets/sprite_assets/pngs/v2/isometric-test/date-palms/baskets-dates.webp";
import type { FarmSnapshot } from "../../schemas/farm";
import type { FarmCoordinate } from "../../game-core/farm/irrigation";
import { executeGameCommand } from "../api/gameActions";
import { farmStore } from "../stores/farmStore";
import { workerLocationStore } from "../stores/workerLocationStore";
import TileActionButton from "./TileActionButton";
import styles from "../styles/GameCanvas.module.scss";
import { PALM_TENDING_WINDOW_MS, palmTendingReason } from "../../game-data/datePalmCycle";
import InfoAlert from "./InfoAlert";
import actionStyles from "../styles/BuildingActionButton.module.scss";
import popupStyles from "../styles/IsometricTest.module.scss";
import grownPalmIcon from "../../assets/sprite_assets/pngs/v2/isometric-test/date-palms/date-palm-isometric-empty.webp";
import { plantingBlocker } from "../game/phaser/isometricPlanting";
import CropGrowthProgress from "./CropGrowthProgress";
import PalmHarvestProgress from "./PalmHarvestProgress";
import PalmPlantingProgress from "./PalmPlantingProgress";

const tendingCountdown = (milliseconds: number) => {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${seconds >= 3600 ? `${Math.floor(seconds / 3600)}h ` : ""}${Math.floor(seconds / 60) % 60}m ${seconds % 60}s`;
};

export function PerennialCropAction({ snapshot, cropKey, target, now, action, isometric = false, getFarmerPosition, onRequestPlant, onStarted }: {
  snapshot: FarmSnapshot; cropKey: PerennialCropKey; target: FarmCoordinate; now: number; action: "plant" | "harvest" | "tend";
  isometric?: boolean;
  getFarmerPosition?: () => FarmCoordinate | undefined;
  onRequestPlant?: () => void;
  onStarted?: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const definition = CROP_DEFINITIONS[cropKey];
  const reason = (isometric ? plantingBlocker(snapshot, now) : null) ?? perennialActionReason(snapshot, cropKey, target, action, now);
  const submit = async () => {
    if (inFlight.current || reason) return;
    if (action === "plant" && onRequestPlant) { onRequestPlant(); return; }
    inFlight.current = true; setPending(true); setError(null);
    try {
      farmStore.getState().setReady(await executeGameCommand({ type: "tend_perennial_crop", crop: cropKey, action, target,
        farmerPosition: getFarmerPosition?.() ?? workerLocationStore.getState().farmerPosition, expectedFarmVersion: snapshot.farm.version }));
      onStarted?.();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not tend the crop."); }
    finally { inFlight.current = false; setPending(false); }
  };
  if (isometric && reason && !pending && !error) return null;
  const button = <TileActionButton className={isometric ? actionStyles.button : undefined} disabled={pending || reason !== null} onClick={() => void submit()}>
      {isometric && (action !== "plant" ? <span className={actionStyles.icon} aria-hidden="true"><img src={action === "harvest" ? datesIcon : grownPalmIcon} alt="" draggable={false} /></span>
        : <img src={grownPalmIcon} alt="" width={36} height={36} style={{ objectFit: "contain" }} />)}
      <span>{pending ? "Starting…" : (!isometric && reason) || (action === "plant" ? `Plant ${definition.label.toLowerCase()}${onRequestPlant ? "" : ` · ${definition.saplingCost} shekels`}` : action === "tend" ? "Tend palm" : "Harvest dates")}</span>
    </TileActionButton>;
  return <>
    {error && <p role="alert">{error}</p>}
    {isometric && action !== "plant" ? <div className={popupStyles.popupActions}>{button}</div> : button}
  </>;
}

export default function PerennialCropContent({ snapshot, target, now, isometric = false, getFarmerPosition, onStarted }: {
  snapshot: FarmSnapshot; target: FarmCoordinate; now: number; isometric?: boolean;
  getFarmerPosition?: () => FarmCoordinate | undefined; onStarted?: () => void;
}) {
  const crop = snapshot.crops.find(c => c.column === target.column && c.row === target.row);
  if (!crop || crop.cropKey !== "datePalm") return null;
  const definition = CROP_DEFINITIONS[crop.cropKey];
  const matureAt = Date.parse(crop.plantedAt) + definition.growthDurationMs;
  const readyAt = Date.parse(crop.growthCompletesAt);
  const cycle = snapshot.farm.production.palmCycles?.[crop.id];
  const tendingReason = palmTendingReason(cycle, readyAt, now);
  const young = now < matureAt;
  const deadline = young ? matureAt : readyAt;
  const ready = now >= readyAt;
  const progress = young ? (now - Date.parse(crop.plantedAt)) / definition.growthDurationMs
    : cycle ? ((now - cycle.startedAt) + (cycle.tendedAt === undefined ? 0 : Math.max(0, now - cycle.tendedAt))) / (cycle.originalReadyAt - cycle.startedAt)
    : 1 - (readyAt - now) / (12 * 3600000);
  const minutes = Math.max(0, Math.ceil((deadline - now) / 60000));
  if (isometric) {
    const job = snapshot.farm.production.cropWork;
    const working = job?.cropId === crop.id && !job.settled && now < job.completesAt;
    const action = ready ? "harvest" : "tend";
    const blocked = plantingBlocker(snapshot, now) ?? perennialActionReason(snapshot, "datePalm", target, action, now);
    return <>
      {working ? (job.action === "harvest" ? <PalmHarvestProgress job={job} now={now} /> : <PalmPlantingProgress job={job} now={now} />) : <>
        <p>{ready ? `${definition.harvestYield} baskets of dates ready to harvest.` : young ? "This sapling is growing into a date palm." : "The next dates are ripening."}</p>
        {!ready && <CropGrowthProgress percentage={progress * 100} remainingMs={deadline - now} label="Dates ripening" />}
        {!ready && !young && !blocked && cycle && <p>
          <strong>Tend within {tendingCountdown(cycle.startedAt + PALM_TENDING_WINDOW_MS - now)}</strong><br />
          Tending halves the remaining growing time.
        </p>}
        {young && <InfoAlert>Tending becomes available after the first harvest.</InfoAlert>}
        {(ready || !young) && (blocked ? <InfoAlert>{blocked}</InfoAlert> :
          <PerennialCropAction snapshot={snapshot} cropKey="datePalm" target={target} now={now} action={action}
            isometric getFarmerPosition={getFarmerPosition} onStarted={onStarted} />)}
      </>}
    </>;
  }
  return <div className={styles["tile-popover-content"]}>
    <div className={styles["tile-popover-content-header"]}>{definition.label}</div>
    <div className={styles["tile-popover-content-body"]}>
      <span>{ready && <img src={datesIcon} alt="" width={32} height={32} />} {ready ? `${definition.harvestYield} baskets of dates ready to harvest.` : young ? "This sapling is growing into a date palm." : "The next dates are ripening."}</span>
      {!ready && <><span>{minutes >= 60 && `${Math.floor(minutes / 60)}h `}{minutes % 60}m remaining</span>
        <progress max={100} value={Math.max(0, Math.min(100, 100 * progress))} aria-label={young ? "Palm maturity" : "Dates ripening"} /></>}
      <span>Dates ripen in 24 hours after harvest. Tend once during the first 12 hours to halve the remaining time. Ripe fruit waits until collected.</span>
      {!ready && !young && (tendingReason ? <InfoAlert>{tendingReason}</InfoAlert>
        : <PerennialCropAction snapshot={snapshot} cropKey={crop.cropKey} target={target} now={now} action="tend" />)}
      {ready && <><span>Harvest one palm at a time. The warehouse must have room for both baskets before harvesting can start.</span>
        <PerennialCropAction snapshot={snapshot} cropKey={crop.cropKey} target={target} now={now} action="harvest" /></>}
    </div>
  </div>;
}
