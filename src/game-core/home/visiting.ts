import type { HomeVisibility } from "../../schemas/homeAppearance";
/** Missing settings on existing houses mean public, matching new houses. */
export const homeVisitUnavailable = (viewerLevel: number, ownerLevel: number, visibility: HomeVisibility = "everyone", isOwner = false): string | null => {
  if (viewerLevel < 10) return "Home visits unlock at level 10.";
  if (ownerLevel < 10) return "This home opens to visitors at level 10.";
  if (visibility === "private" && !isOwner) return "This home is private.";
  return null;
};
