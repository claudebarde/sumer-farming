import BuildingActionIcon from "./BuildingActionIcon";
import actionStyles from "../styles/BuildingActionButton.module.scss";
import { useRef, useState } from "react";
import { Dialog } from "radix-ui";
import type { FarmSnapshot } from "../../schemas/farm";
import { buildingDemolitionReason } from "../../game-core/farm/buildingDemolition";
import { buildingNames } from "../game/phaser/isometricFarm";
import { executeGameCommand } from "../api/gameActions";
import styles from "../styles/GameCanvas.module.scss";

export default function DestroyBuildingDialog({ snapshot, buildingId, now, onClose, onDestroyed }: {
  snapshot: FarmSnapshot; buildingId: string; now: number; onClose: () => void;
  onDestroyed: (snapshot: FarmSnapshot) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const building = snapshot.buildings.find(b => b.id === buildingId);
  const reason = buildingDemolitionReason(snapshot, buildingId, now);
  const destroy = async () => {
    if (submitting.current || reason) return;
    submitting.current = true; setPending(true); setError(null);
    try {
      const next = await executeGameCommand({ type: "destroy_building", buildingId, expectedFarmVersion: snapshot.farm.version });
      onDestroyed(next); onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not destroy the building.");
    } finally { submitting.current = false; setPending(false); }
  };
  return <Dialog.Root open onOpenChange={open => { if (!open && !submitting.current) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className={styles["market-dialog-overlay"]} />
      <Dialog.Content className={`${styles["market-dialog-content"]} ${styles["demolition-dialog"]}`}
        onPointerDownOutside={event => event.preventDefault()}>
        <Dialog.Title>Are you sure you want to destroy {building ? buildingNames[building.type] : "this building"}?</Dialog.Title>
        <Dialog.Description>This cannot be undone. Construction materials and upgrades are lost; nothing is refunded.</Dialog.Description>
        {building?.type === "brewery" && <p>Any remaining brewing supplies will also be lost.</p>}
        {(error || reason) && <p role="alert">{error ?? reason}</p>}
        <div className={styles["demolition-actions"]}>
          <button className={actionStyles.button} disabled={pending} onClick={onClose}><BuildingActionIcon kind="cancel" /><span>Cancel</span></button>
          {!reason && <button className={actionStyles.button} disabled={pending} onClick={() => void destroy()}><BuildingActionIcon kind="destroy" /><span>{pending ? "Destroying…" : "Destroy the building"}</span></button>}
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
