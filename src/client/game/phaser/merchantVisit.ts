import { getRequestWindow } from "../../../game-core/market/npcRequests";
import { MERCHANT_TRAVEL_MS, REQUEST_CYCLE_MS, REQUEST_OPEN_MS } from "../../../game-data/npcRequests";

type Schedule = { readonly cycle: number; readonly closesAt: string };
export type MerchantVisit =
  | { readonly phase: "away" | "stopped" }
  | { readonly phase: "arriving" | "departing"; readonly progress: number };

/** Derive travel from server timestamps; no replaying missed visits on login. */
export const getMerchantVisit = (schedule: Schedule, now: number): MerchantVisit => {
  const anchor = Date.parse(schedule.closesAt) - REQUEST_OPEN_MS - schedule.cycle * REQUEST_CYCLE_MS;
  const window = getRequestWindow(anchor, now);
  if (window.open) return { phase: "stopped" };
  if (now >= window.closesAt && now < window.closesAt + MERCHANT_TRAVEL_MS) {
    return { phase: "departing", progress: (now - window.closesAt) / MERCHANT_TRAVEL_MS };
  }
  const arrival = now < anchor ? anchor : window.nextOpensAt;
  if (now >= arrival - MERCHANT_TRAVEL_MS && now < arrival) {
    return { phase: "arriving", progress: (now - arrival + MERCHANT_TRAVEL_MS) / MERCHANT_TRAVEL_MS };
  }
  return { phase: "away" };
};
