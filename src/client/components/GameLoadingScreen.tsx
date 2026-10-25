import { useEffect, useState } from "react";
import type { GameLoadingState } from "../game/phaser/gameLoading";
import styles from "../styles/IsometricTest.module.scss";

export default function GameLoadingScreen({
  state,
  retry
}: {
  state: Exclude<GameLoadingState, "ready">;
  retry: () => void;
}) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 20_000);
    return () => window.clearTimeout(timer);
  }, []);
  const failed = state === "error";
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
          𒂍 𒌙 <br /> 𒀀𒇉𒄘𒃼 𒀀𒇉𒌓𒄒𒉣𒈾𒅗
        </span>
        <h2>
          {failed
            ? "Your farm couldn’t load"
            : state === "recovering"
              ? "Returning to your farm"
              : "Preparing your farm"}
        </h2>
        <p>
          {failed
            ? "Check your connection and try again."
            : "Your estate will appear in a moment."}
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
