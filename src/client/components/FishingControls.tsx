import { useState } from "react";
import { useStore } from "zustand";
import { farmStore } from "../stores/farmStore";
import { executeGameCommand } from "../api/gameActions";
import styles from "../styles/GameCanvas.module.scss";

export default function FishingControls() {
  const farm = useStore(farmStore, state => state.farm);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const session = farm.type === "ready" ? farm.snapshot.farm.fishing : null;
  if (!session) return null;
  return <aside className={styles["fishing-controls"]} aria-label="Fishing controls">
    <strong>Fishing</strong>
    <span>Tap the highlighted river ahead of the fish. The hook lands after 0.4 seconds.</span>
    <small>Missed? Wait 2 seconds and try again. Keyboard: ← → to aim, Space to cast.</small>
    {error && <span role="alert">{error}</span>}
    <button disabled={pending} onClick={() => {
      setPending(true); setError(null);
      void executeGameCommand({ type: "cancel_fishing", sessionId: session.id }).then(
        snapshot => farmStore.getState().setReady(snapshot),
        cause => setError(cause instanceof Error ? cause.message : "Could not stop fishing.")
      ).finally(() => setPending(false));
    }}>Stop fishing</button>
  </aside>;
}
