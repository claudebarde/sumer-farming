import { farmerProductionJob } from "../../game-core/farm/farmerProduction";
import type { FarmSnapshot } from "../../schemas/farm";
import { BREAD_RECIPE } from "../../game-data/production";
import type { TilePosition } from "../game/phaser/types";
import type { FarmerCommandInput } from "../stores/farmerCommandStore";
import styles from "../styles/GameCanvas.module.scss";

export default function BreadOvenContent({
  snapshot,
  buildingId,
  target,
  now,
  addCommand
}: {
  readonly snapshot: FarmSnapshot;
  readonly buildingId: string;
  readonly target: TilePosition;
  readonly now: number;
  readonly addCommand: (command: FarmerCommandInput) => void;
}) {
  const oven = snapshot.buildings.find(b => b.id === buildingId);
  const job = snapshot.farm.production.baking[buildingId];
  const flour =
    snapshot.inventory.find(i => i.itemKey === "flour")?.quantity ?? 0;
  const constructionRemaining = oven
    ? Math.max(0, Math.ceil((Date.parse(oven.completesAt) - now) / 1000))
    : 0;
  const constructionProgress = oven
    ? Math.min(
        100,
        Math.max(
          0,
          ((now - Date.parse(oven.startedAt)) /
            Math.max(
              1,
              Date.parse(oven.completesAt) - Date.parse(oven.startedAt)
            )) *
            100
        )
      )
    : 0;
  const unavailable =
    !oven || Date.parse(oven.completesAt) > now
      ? "The oven is under construction."
      : job
        ? "The farmer is working inside the oven. Other tasks are unavailable until baking finishes."
        : (snapshot.farm.progression?.level ?? 1) < 6
          ? "Unlock at level 6."
          : snapshot.farm.carriedItem ||
              farmerProductionJob(snapshot.farm) ||
              snapshot.farm.millGoods.delivery ||
              snapshot.farm.production.delivery ||
              snapshot.farm.fishing ||
              snapshot.farm.gathering
            ? "Finish the current task and empty your hands first."
            : flour < BREAD_RECIPE.flour
              ? "Store more Flour before baking."
              : null;
  return (
    <div className={styles["tile-popover-content"]}>
      <div className={styles["tile-popover-content-header"]}>
        <span className="cuneiforms">𒌅𒊒𒈾</span>
        Bread Oven
      </div>
      <div className={styles["tile-popover-content-body"]}>
        <p>
          {BREAD_RECIPE.flour} Flour → {BREAD_RECIPE.output} Bread ·{" "}
          {BREAD_RECIPE.durationMs / 60000} minutes
        </p>
        <p>Stored Flour: {flour}.</p>
        <p>The farmer collects flour from the farm, then works at the oven for the full 5 minutes.</p>
        <p>
          Finished bread waits in a basket beside the oven until delivered to
          the farm.
        </p>
        {constructionRemaining > 0 && (
          <>
            <p>
              Construction: {Math.floor(constructionRemaining / 60)}m{" "}
              {constructionRemaining % 60}s remaining.
            </p>
            <progress
              className={styles["crop-growth-progress"]}
              aria-label="Bread oven construction progress"
              max={100}
              value={constructionProgress}
            />
          </>
        )}
        {job && (
          <>
            <p>
              {Math.max(
                0,
                Math.ceil((Date.parse(job.completesAt) - now) / 1000)
              )}{" "}
              seconds remaining.
            </p>
            <progress
              aria-label="Baking progress"
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
        )}
        {unavailable && constructionRemaining === 0 && <p>{unavailable}</p>}
        <button
          disabled={unavailable !== null}
          onClick={() =>
            addCommand({
              type: "production",
              action: "bake",
              buildingId,
              target
            })
          }
        >
          Bake bread
        </button>
      </div>
    </div>
  );
}
