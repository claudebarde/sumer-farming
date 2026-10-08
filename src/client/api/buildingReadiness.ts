import { z } from "zod";
import { FarmBuildingTypeSchema } from "../../game-data/buildings";
import { developmentPlayerHeaders } from "./developmentPlayer";

export const OPEN_BUILD_DRAWER = "sumer:open-build-drawer";
export const claimBuildingReadiness = async () => {
  const response = await fetch("/api/notifications/building-ready", { method: "POST", headers: developmentPlayerHeaders() });
  if (!response.ok) throw new Error("Could not check building readiness.");
  return z.object({ building: FarmBuildingTypeSchema.nullable() }).parse(await response.json()).building;
};
