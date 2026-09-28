import { useStore } from "zustand";
import { fetchStore } from "../stores/fetchStore";
import styles from "../styles/GameCanvas.module.scss";

export default function FetchControls() {
  const { phase, message, set } = useStore(fetchStore);
  if (phase === "idle") return null;
  return <aside className={styles["fishing-controls"]} aria-label="Play fetch">
    <strong>{phase === "menu" ? "Farm dog" : "Play fetch"}</strong>
    <span role="status">{message || "Land the stick ahead of the dog before it stops. Watch for its slowdown!"}</span>
    {(phase === "menu" || phase === "result") ? <>
      <small>No resources or happiness are gained or lost.</small>
      <button onClick={() => set("starting")}>{phase === "result" ? "Play again" : "Play Fetch"}</button>
    </> : <small>Move to aim, click to throw. Touch: drag and release. Keyboard: arrow keys to aim, Space to throw.</small>}
    <button onClick={() => set("idle")}>{phase === "menu" || phase === "result" ? "Close" : "Stop playing"}</button>
  </aside>;
}
