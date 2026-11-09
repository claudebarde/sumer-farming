import { useEffect, useState } from "react";
import type { GameLoadingState } from "../game/phaser/gameLoading";
import styles from "../styles/IsometricTest.module.scss";

export default function GameLoadingScreen({
  state,
  retry,
  destination = "farm",
  homeOwnerName
}: {
  state: Exclude<GameLoadingState, "ready">;
  retry: () => void;
  destination?: "farm" | "home";
  homeOwnerName?: string;
}) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 20_000);
    return () => window.clearTimeout(timer);
  }, []);
  const failed = state === "error";
  const place = destination === "home" ? "home" : "farm";
  const visitingHome = destination === "home" && homeOwnerName;
  const target = visitingHome ? `${homeOwnerName}’s home` : `your ${place}`;
  const sentenceTarget = visitingHome ? target : `Your ${place}`;
  return (
    <div className={styles.loadingScreen}>
      <div
        className={styles.loadingCard}
        role={failed ? "alert" : "status"}
        aria-live="polite"
      >
        <span
          className={`cuneiforms ${styles.loadingEmblem}`}
          aria-hidden="true"
        >
          𒀀𒊮 𒆠𒂗𒄀𒊏
        </span>
        <h2>
          {failed
            ? `${sentenceTarget} couldn’t load`
            : state === "recovering"
              ? `Returning to ${target}`
              : `Preparing ${target}`}
        </h2>
        <p>
          {failed
            ? "Check your connection and try again."
            : destination === "home" ? `${sentenceTarget} will appear in a moment.` : "Your estate will appear in a moment."}
        </p>
        {!failed && (
          <div className={styles.loadingTrack} aria-hidden="true">
            <span />
          </div>
        )}
        {(failed || slow) && (
          <>
            {!failed && <p>This is taking longer than usual.</p>}
            <button onClick={retry}>Reload game</button>
          </>
        )}
      </div>
    </div>
  );
}
