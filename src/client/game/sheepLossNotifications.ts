import type { FarmSnapshot } from "../../schemas/farm";
import { notificationStore } from "../stores/notificationStore";
const announced = new Set<string>();
/** Persist toast receipts locally so polling and reloads do not repeat an old loss. */
export function notifySheepLosses(snapshot: FarmSnapshot) {
  const fresh = (snapshot.farm.production.livestock?.losses ?? []).filter(loss => {
    const key = `sheep-loss:${snapshot.farm.id}:${loss.id}`;
    if (announced.has(key)) return false;
    announced.add(key);
    try { if (localStorage.getItem(key)) return false; localStorage.setItem(key, "1"); } catch { /* Session deduplication still works without browser storage. */ }
    return true;
  });
  if (fresh.length) notificationStore.getState().notifyError(`${fresh.length === 1 ? "An animal was" : `${fresh.length} animals were`} lost because the flock was not fed within 48 hours of needing food.`);
}
