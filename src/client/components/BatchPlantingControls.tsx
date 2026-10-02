import { useState } from "react";
import { useStore } from "zustand";
import { batchPlantingStore } from "../stores/batchPlantingStore";
import { farmStore } from "../stores/farmStore";
import { farmerCommandStore } from "../stores/farmerCommandStore";
import { executeGameCommand } from "../api/gameActions";
import {
  fieldKey,
  plantableFields,
  harvestableFields,
  availablePlantingBarley
} from "../../game-core/farm/batchPlanting";
import { MAX_BATCH_HARVEST_FIELDS } from "../../game-data/batchPlanting";
import styles from "../styles/GameCanvas.module.scss";

export default function BatchPlantingControls({
  now
}: {
  readonly now: number;
}) {
  const selection = useStore(batchPlantingStore);
  const farm = useStore(farmStore, s => s.farm);
  const status = useStore(farmerCommandStore, s => s.status);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (farm.type !== "ready") return null;
  const batch = farm.snapshot.farm.production.planting;
  if (!selection.active && !batch) return null;
  const harvesting = batch
    ? batch.mode === "harvest"
    : selection.mode === "harvest";
  const verb = harvesting ? "harvesting" : "planting";
  const available = harvesting
    ? MAX_BATCH_HARVEST_FIELDS
    : availablePlantingBarley(farm.snapshot, now);
  const eligible = new Set(
    (harvesting ? harvestableFields : plantableFields)(farm.snapshot, now).map(
      fieldKey
    )
  );
  const valid =
    selection.selected.length > 0 &&
    selection.selected.length <= available &&
    selection.selected.every(p => eligible.has(fieldKey(p)));
  const submit = async () => {
    setPending(true);
    setError(null);
    try {
      const snapshot = await executeGameCommand(
        batch
          ? {
              type: "advance_batch_planting",
              action: "stop",
              batchId: batch.id,
              expectedFarmVersion: farm.snapshot.farm.version
            }
          : {
              type: harvesting
                ? "start_batch_harvesting"
                : "start_batch_planting",
              targets: [...selection.selected],
              expectedFarmVersion: farm.snapshot.farm.version
            }
      );
      farmStore.getState().setReady(snapshot);
      batchPlantingStore.getState().cancel();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not update the field job."
      );
    } finally {
      setPending(false);
    }
  };
  const actionDisabled =
    pending || (!batch && !valid) || !!batch?.stopRequested;
  return (
    <section
      className={`dialog-bottom-container nes-container is-centered is-rounded ${styles["batch-planting-controls"]}`}
      aria-label={
        harvesting ? "Harvest multiple fields" : "Plant multiple fields"
      }
    >
      <p role="status">
        {batch
          ? batch.phase.type === "collecting"
            ? `Collecting ${batch.remaining.length - (batch.carriedSeeds?.quantity ?? 0)} barley seeds…`
            : `${harvesting ? "Harvesting" : "Planting"} ${Math.min(batch.total, batch.total - batch.remaining.length + (batch.phase.type === "sowing" || batch.phase.type === "harvesting" ? 0 : 1))} of ${batch.total} fields`
          : harvesting
            ? `${selection.selected.length} / ${MAX_BATCH_HARVEST_FIELDS} fields selected \n ${selection.selected.length * 10}s harvesting + travel`
            : `${selection.selected.length} fields selected · ${selection.selected.length} / ${available} barley · ${selection.selected.length * 10}s planting + travel`}
      </p>
      {selection.active && (
        <p>
          {harvesting
            ? "Tap yellow fields to select up to 4; tap green fields to deselect."
            : "Tap yellow fields to select them; tap selected fields to deselect. Red means no seeds left."}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {batch && status.type === "failed" && <p role="alert">{status.reason}</p>}
      <div>
        {batch && status.type === "failed" && (
          <button
            className="nes-btn"
            onClick={() =>
              batchPlantingStore.setState(s => ({ retry: s.retry + 1 }))
            }
          >
            Resume {verb}
          </button>
        )}
        <button
          className={`nes-btn${actionDisabled ? " is-disabled" : !batch ? " is-primary" : ""}`}
          disabled={actionDisabled}
          onClick={() => {
            void submit();
          }}
        >
          {pending
            ? "Please wait…"
            : batch
              ? batch.stopRequested
                ? "Stopping after this field…"
                : "Stop after this field"
              : harvesting
                ? "Harvest barley"
                : "Plant barley"}
        </button>
        {!batch && (
          <button
            className={`nes-btn${pending ? " is-disabled" : " is-error"}`}
            disabled={pending}
            onClick={() => {
              setError(null);
              selection.cancel();
            }}
          >
            Cancel
          </button>
        )}
      </div>
    </section>
  );
}
