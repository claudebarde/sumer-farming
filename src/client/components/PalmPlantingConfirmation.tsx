import { useRef, useState } from "react";
import type { FarmSnapshot } from "../../schemas/farm";
import type { FarmCoordinate } from "../../game-core/farm/irrigation";
import { CROP_DEFINITIONS } from "../../game-data/crops";
import { perennialActionReason } from "../../game-core/farm/perennialCrops";
import { plantingBlocker } from "../game/phaser/isometricPlanting";
import { executeGameCommand } from "../api/gameActions";
import InfoAlert from "./InfoAlert";
import palmIcon from "../../assets/sprite_assets/pngs/v2/isometric-test/date-palms/date-palm-isometric-empty.png";
import styles from "../styles/IsometricTest.module.scss";

export default function PalmPlantingConfirmation({ snapshot, target, now, getFarmerPosition, onStarted, onCancel }: {
  snapshot: FarmSnapshot; target: FarmCoordinate; now: number;
  getFarmerPosition: () => FarmCoordinate | undefined;
  onStarted: (snapshot: FarmSnapshot) => void; onCancel: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const reason = plantingBlocker(snapshot, now) ?? perennialActionReason(snapshot, "datePalm", target, "plant", now);
  const confirm = async () => {
    if (inFlight.current || reason) return;
    inFlight.current = true; setPending(true); setError(null);
    try {
      const next = await executeGameCommand({ type: "tend_perennial_crop", crop: "datePalm", action: "plant", target,
        farmerPosition: getFarmerPosition(), expectedFarmVersion: snapshot.farm.version });
      onStarted(next);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not plant the date palm."); }
    finally { inFlight.current = false; setPending(false); }
  };
  return <aside className={styles.planting} aria-label="Confirm date palm planting">
    <div className={styles.sowingProgress}>
      <img className={styles.barleyWorkIcon} src={palmIcon} alt="" width={48} height={48} />
      <p>Plant date palm · {CROP_DEFINITIONS.datePalm.saplingCost} shekels</p>
    </div>
    {reason && <InfoAlert>{reason}</InfoAlert>}
    {error && <p role="alert">{error}</p>}
    <div><button disabled={pending || reason !== null} onClick={() => void confirm()}>{pending ? "Planting…" : "Confirm"}</button>
      <button disabled={pending} onClick={onCancel}>Cancel</button></div>
  </aside>;
}
