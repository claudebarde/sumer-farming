import { useRef, useState } from "react";
import type { FarmSnapshot } from "../../schemas/farm";
import type { FarmCoordinate } from "../../game-core/farm/irrigation";
import { sesameActionReason } from "../../game-core/farm/sesame";
import { plantingBlocker } from "../game/phaser/isometricPlanting";
import { executeGameCommand } from "../api/gameActions";
import { farmStore } from "../stores/farmStore";
import { workerLocationStore } from "../stores/workerLocationStore";
import basket from "../../assets/sprite_assets/pngs/v2/isometric-test/sesame/sesame-basket-isometric.png";
import actionStyles from "../styles/BuildingActionButton.module.scss";
import popupStyles from "../styles/IsometricTest.module.scss";
import InfoAlert from "./InfoAlert";
import CropGrowthProgress from "./CropGrowthProgress";
import PalmPlantingProgress from "./PalmPlantingProgress";
import PalmHarvestProgress from "./PalmHarvestProgress";

type Props = { snapshot: FarmSnapshot; target: FarmCoordinate; now: number; getFarmerPosition?: () => FarmCoordinate | undefined; onStarted?: () => void };

export function SesameAction({ snapshot, target, now, getFarmerPosition, onStarted, action }: Props & { action: "plant" | "harvest" }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const reason = plantingBlocker(snapshot, now) ?? sesameActionReason(snapshot, target, action, now);
  const submit = async () => {
    if (reason || inFlight.current) return;
    inFlight.current = true; setPending(true); setError(null);
    try {
      farmStore.getState().setReady(await executeGameCommand({ type: "work_sesame", crop: "sesame", action, target,
        farmerPosition: getFarmerPosition?.() ?? workerLocationStore.getState().farmerPosition, expectedFarmVersion: snapshot.farm.version }));
      onStarted?.();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not start sesame work."); }
    finally { inFlight.current = false; setPending(false); }
  };
  return <>
    {error && <InfoAlert>{error}</InfoAlert>}
    {reason && <InfoAlert>{reason}</InfoAlert>}
    <button className={actionStyles.button} disabled={pending || !!reason} onClick={() => void submit()}>
      <span className={actionStyles.icon} aria-hidden="true"><img src={basket} alt="" draggable={false} /></span>
      <span>{pending ? "Starting…" : action === "plant" ? "Plant sesame" : "Harvest sesame"}</span>
    </button>
    {action === "plant" && !reason && <p>Uses 1 basket of sesame.</p>}
  </>;
}

export default function SesameCropContent(props: Props) {
  const { snapshot, target, now } = props;
  const crop = snapshot.crops.find(c => c.cropKey === "sesame" && c.column === target.column && c.row === target.row);
  if (!crop) return null;
  const job = snapshot.farm.production.cropWork;
  if (job?.cropId === crop.id && !job.settled) return job.action === "harvest"
    ? <PalmHarvestProgress job={job} now={now} /> : <PalmPlantingProgress job={job} now={now} />;
  const start = Date.parse(crop.plantedAt), end = Date.parse(crop.growthCompletesAt);
  return now < end ? <CropGrowthProgress percentage={(now - start) / (end - start) * 100} remainingMs={end - now} label="Sesame growing" />
    : <><p>3 baskets of sesame ready to harvest.</p><div className={popupStyles.popupActions}><SesameAction {...props} action="harvest" /></div></>;
}
