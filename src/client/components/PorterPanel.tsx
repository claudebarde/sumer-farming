import { useRef, useState } from "react";
import type { FarmSnapshot } from "../../schemas/farm";
import { PORTER_COST, PORTER_HIRE_MS } from "../../game-data/porter";
import { executeGameCommand } from "../api/gameActions";
import { farmStore } from "../stores/farmStore";
import { workerLocationStore } from "../stores/workerLocationStore";
import styles from "../styles/GameCanvas.module.scss";
import cardStyles from "../styles/FarmerTreats.module.scss";
import porterIcon from "../../assets/sprite_assets/pngs/v2/isometric-test/porter/porter-empty-idle.webp";

export default function PorterPanel({ snapshot, now, marketRoad }: { snapshot: FarmSnapshot; now: number; marketRoad?: { column: number; row: number } }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestKey = useRef<string | null>(null);
  const porter = snapshot.farm.production.porter;
  const minutes = Math.max(0, Math.ceil(((porter?.expiresAt ?? 0) - now) / 60000));
  const active = minutes > 0 || !!porter?.job || !!porter?.returnTrip;
  const unlocked = (snapshot.farm.progression?.level ?? 1) >= 5;
  const hire = async () => {
    if (pending) return;
    setPending(true); setError(null);
    requestKey.current ??= crypto.randomUUID();
    try {
      const updated = await executeGameCommand({ type: "hire_porter", marketRoad: marketRoad ?? workerLocationStore.getState().marketRoad, idempotencyKey: requestKey.current, expectedFarmVersion: snapshot.farm.version });
      farmStore.getState().setReady(updated); requestKey.current = null;
    } catch (e) { setError(e instanceof Error ? e.message : "Could not hire the porter."); }
    finally { setPending(false); }
  };
  return <section className={styles["porter-panel"]} aria-label="Farm services">
    <h2>Farm services</h2>
    <div className={styles["resource-sections"]}><section className={`${cardStyles.card} ${cardStyles.serviceCard}`} data-locked={!unlocked ? "true" : undefined} aria-label="Porter service">
    <div className={cardStyles.serviceDescription}>
      <img src={porterIcon} alt="" width={64} height={80} draggable={false} />
      <div><h3>Porter</h3><p>Stores finished flour, groats, bread and beer, even while you’re away. Takes what fits and leaves the rest when storage is full.</p></div>
    </div>
    <div className={cardStyles.action}>
    <strong>{PORTER_COST} shekels</strong>
    <small>For {PORTER_HIRE_MS / 3600000} hours · No automatic renewal</small>
    {error && <small role="alert">{error}</small>}
    <button disabled={pending || active || !unlocked || snapshot.player.shekelBalance < PORTER_COST} onClick={() => void hire()}>
      {!unlocked ? "Unlock at level 5" : active ? minutes > 0 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m remaining` : "Finishing his last delivery" : pending ? "Hiring…" : snapshot.player.shekelBalance < PORTER_COST ? "Not enough shekels" : "Hire porter"}
    </button>
    </div>
  </section></div></section>;
}
