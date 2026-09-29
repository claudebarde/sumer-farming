import type { FarmSnapshot } from "../../schemas/farm";
import type { TilePosition } from "../game/phaser/types";
import type { FarmerCommandInput } from "../stores/farmerCommandStore";
import { MILL_RECIPES, type MillRecipe } from "../../game-data/milling";
import {
  millingUnavailableReason
} from "../../game-core/farm/milling";
import styles from "../styles/GameCanvas.module.scss";

export default function MillContent({
  snapshot,
  target,
  now,
  addCommand
}: {
  readonly snapshot: FarmSnapshot;
  readonly target: TilePosition;
  readonly now: number;
  readonly addCommand: (command: FarmerCommandInput) => void;
}) {
  const job = snapshot.farm.milling;
  return (
    <div className={styles["tile-popover-content"]}>
      <div className={styles["tile-popover-content-header"]}>
        <span className="cuneiforms">𒂍𒄯</span>
        Mill
      </div>
      <div className={styles["tile-popover-content-body"]}>
        {job ? (
          <>
            <p>
              The farmer is producing {MILL_RECIPES[job.recipe].label}. He is
              unavailable until milling finishes.
            </p>
            <p>
              {Math.max(
                0,
                Math.ceil((Date.parse(job.completesAt) - now) / 1000)
              )}{" "}
              seconds remaining.
            </p>
            <progress
              aria-label="Milling progress"
              max={100}
              value={Math.min(
                100,
                Math.max(
                  0,
                  ((now - Date.parse(job.startedAt)) /
                    (Date.parse(job.completesAt) - Date.parse(job.startedAt))) *
                    100
                )
              )}
            />
          </>
        ) : (
          <>
            <p>
              Process barley into Flour or Brewer's Groats. The farmer works
              here for the whole job.
            </p>
            {(Object.keys(MILL_RECIPES) as MillRecipe[]).map(recipe => (
              <p key={recipe}>
                {MILL_RECIPES[recipe].barley} barley →{" "}
                {MILL_RECIPES[recipe].output} {MILL_RECIPES[recipe].label} ·{" "}
                {MILL_RECIPES[recipe].durationMs / 60000} minutes
              </p>
            ))}
            {millingUnavailableReason(snapshot, "flour", now) && (
              <p>{millingUnavailableReason(snapshot, "flour", now)}</p>
            )}
            {(Object.keys(MILL_RECIPES) as MillRecipe[]).map(recipe => (
              <button
                key={recipe}
                disabled={
                  millingUnavailableReason(snapshot, recipe, now) !== null
                }
                onClick={() => addCommand({ type: "mill", target, recipe })}
              >
                Produce {MILL_RECIPES[recipe].label}
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
