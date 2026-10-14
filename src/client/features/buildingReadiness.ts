import type { FarmSnapshot } from "../../schemas/farm";
import { readyProgressionBuilding } from "../../game-core/farm/buildingReadiness";

/** Delay only the cosmetic claim; the material transfer is already persisted. */
export const buildingReadinessCandidate = (snapshot: FarmSnapshot, materialDropFarmId: string | null) =>
  materialDropFarmId === snapshot.farm.id ? null : readyProgressionBuilding(snapshot);
