import { useRef, useState } from "react";
import type { FarmSnapshot } from "../../schemas/farm";
import { PORTER_COST } from "../../game-data/porter";
import { executeGameCommand } from "../api/gameActions";
import { farmStore } from "../stores/farmStore";
import { workerLocationStore } from "../stores/workerLocationStore";
import styles from "../styles/GameCanvas.module.scss";

export default function PorterPanel({ snapshot, now }: { snapshot: FarmSnapshot; now: number }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestKey = useRef<string | null>(null);
  const porter = snapshot.farm.production.porter;
  const minutes = Math.max(0, Math.ceil(((porter?.expiresAt ?? 0) - now) / 60000));
  const active = minutes > 0 || !!porter?.job;
  const unlocked = (snapshot.farm.progression?.level ?? 1) >= 5;
  const hire = async () => {
    if (pending) return;
    setPending(true); setError(null);
    requestKey.current ??= crypto.randomUUID();
    try {
      const updated = await executeGameCommand({ type: "hire_porter", marketRoad: workerLocationStore.getState().marketRoad, idempotencyKey: requestKey.current, expectedFarmVersion: snapshot.farm.version });
      farmStore.getState().setReady(updated); requestKey.current = null;
    } catch (e) { setError(e instanceof Error ? e.message : "Could not hire the porter."); }
    finally { setPending(false); }
  };
  return <div className={`${styles["resource-sections"]} ${styles["porter-panel"]}`}><section data-locked={!unlocked ? "true" : undefined}>
    <h3>Porter</h3>
    <p>Automatically stores finished flour, groats, bread and beer. Works while you are away; waits when storage is full.</p>
    <p>{active ? minutes > 0 ? `Porter hired · ${Math.floor(minutes / 60)}h ${minutes % 60}m remaining` : "Finishing his last delivery" : `${PORTER_COST} shekels for 24 hours. No automatic renewal.`}</p>
    {error && <p role="alert">{error}</p>}
    <button disabled={pending || active || !unlocked || snapshot.player.shekelBalance < PORTER_COST} onClick={() => void hire()}>
      {!unlocked ? "Unlock at level 5" : active ? "Porter hired" : pending ? "Hiring…" : snapshot.player.shekelBalance < PORTER_COST ? "Not enough shekels" : `Hire porter · ${PORTER_COST} shekels`}
    </button>
  </section></div>;
}
