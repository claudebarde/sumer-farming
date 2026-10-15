import { evaluateProgression } from "../../game-core/farm/progression";
import { farmStore } from "../stores/farmStore";
import { notificationStore } from "../stores/notificationStore";
import { executeGameCommand } from "./gameActions";

let claiming = false;
/** Shared claim flow for the level dialog and farm popup. */
export async function claimFarmLevel() {
  const farm = farmStore.getState().farm;
  if (claiming || farm.type !== "ready") return null;
  const progress = evaluateProgression(farm.snapshot, Date.now());
  if (!progress.canClaim) return null;
  claiming = true;
  try {
    const snapshot = await executeGameCommand({ type: "claim_farm_level", expectedLevel: progress.level,
      expectedFarmVersion: farm.snapshot.farm.version });
    const current = farmStore.getState().farm;
    if (current.type !== "ready" || current.snapshot.farm.id !== snapshot.farm.id) return null;
    farmStore.getState().setReady(snapshot);
    if (snapshot.farm.progression!.level > progress.level) {
      notificationStore.getState().notifyLevel(snapshot.farm.playerId, snapshot.farm.id, snapshot.farm.progression!.level);
      return snapshot;
    }
    return null;
  } finally { claiming = false; }
}
