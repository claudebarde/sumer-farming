import type { FarmSnapshot } from "../../../schemas/farm";
import type { Ziggurat } from "../../../schemas/ziggurat";
import { canVisitIsometricMarket } from "./isometricMarket";

export const canVisitNeighbourhood = (snapshot: FarmSnapshot, now: number): boolean =>
  (snapshot.farm.progression?.level ?? 1) >= 7 && canVisitIsometricMarket(snapshot, now) &&
  (!snapshot.farm.production.materialGathering || snapshot.farm.production.materialGathering.settled);

/** Include queued deliveries, but never keep navigation locked by a late animation callback. */
export const neighbourhoodTripActive = (data: Ziggurat | null, slot: number | null, now: number): boolean =>
  slot !== null && [...(data?.deliveries ?? []), ...(data?.interestVisits ?? [])]
    .some(trip => trip.slot === slot && Date.parse(trip.completesAt) > now);
