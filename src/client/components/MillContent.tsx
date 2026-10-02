import type { FarmSnapshot } from "../../schemas/farm";
import { Select } from "radix-ui";
import { ChevronDownIcon } from "@radix-ui/react-icons";
import type { TilePosition } from "../game/phaser/types";
import type { FarmerCommandInput } from "../stores/farmerCommandStore";
import { MILL_RECIPES, millRecipe, type MillRecipe } from "../../game-data/milling";
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
  const remainingSeconds = job ? Math.max(0, Math.ceil((Date.parse(job.completesAt) - now) / 1000)) : 0;
  const ownsDonkey = snapshot.inventory.some(i => i.itemKey === "donkey" && i.quantity > 0);
  const hasWorkerChoice = (snapshot.farm.progression?.level ?? 1) >= 7 && ownsDonkey;
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
              {job.worker === "donkey" ? "The donkey" : "The farmer"} is producing {job.output} {MILL_RECIPES[job.recipe].label}.
              {job.worker === "donkey" ? " The farmer is free to work elsewhere." : " He is unavailable until milling finishes."}
            </p>
            <p>
              {Math.floor(remainingSeconds / 60)}m {remainingSeconds % 60}s remaining.
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
              Process barley into Flour or Brewer's Groats.{hasWorkerChoice && " Choose who produces it."}
            </p>
            <table className={styles["mill-recipe-table"]}>
              <caption>Per batch · flour or groats</caption>
              <thead><tr><th scope="col">Worker</th><th scope="col">Barley</th><th scope="col">Bags</th><th scope="col">Time</th></tr></thead>
              <tbody>
                {(["farmer", "donkey"] as const).filter(worker => worker === "farmer" || hasWorkerChoice).map(worker => {
                  const recipe = millRecipe("flour", worker);
                  return <tr key={worker}>
                    <th scope="row">{worker === "farmer" ? "Farmer" : "Donkey"}</th>
                    <td>{recipe.barley}</td><td>{recipe.output}</td><td>{recipe.durationMs / 60000} min</td>
                  </tr>;
                })}
              </tbody>
            </table>
            {millingUnavailableReason(snapshot, "flour", now) && (
              <p>{millingUnavailableReason(snapshot, "flour", now)}</p>
            )}
            {hasWorkerChoice && millingUnavailableReason(snapshot, "flour", now, "donkey") && <p>{millingUnavailableReason(snapshot, "flour", now, "donkey")}</p>}
            {(Object.keys(MILL_RECIPES) as MillRecipe[]).map(recipe => {
              const farmerReason = millingUnavailableReason(snapshot, recipe, now);
              const donkeyReason = millingUnavailableReason(snapshot, recipe, now, "donkey");
              const label = recipe === "flour" ? "Produce flour" : "Produce groats";
              if (!hasWorkerChoice) return <button key={recipe} disabled={farmerReason !== null}
                onClick={() => addCommand({ type: "mill", target, recipe, worker: "farmer" })}>
                {label}
              </button>;
              return <Select.Root key={recipe} value="" disabled={farmerReason !== null && donkeyReason !== null}
                onValueChange={worker => {
                  if ((worker === "farmer" || worker === "donkey") && millingUnavailableReason(snapshot, recipe, now, worker) === null)
                    addCommand({ type: "mill", target, recipe, worker });
                }}>
                <Select.Trigger className={styles["mill-select-trigger"]} aria-label={label}>
                  <Select.Value placeholder={label} />
                  <Select.Icon><ChevronDownIcon /></Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className={styles["mill-select-content"]} position="popper" sideOffset={4} collisionPadding={12}>
                    <Select.Viewport>
                      <Select.Item className={styles["mill-select-item"]} value="farmer" disabled={farmerReason !== null} title={farmerReason ?? undefined}>
                        <Select.ItemText>Produce with the farmer</Select.ItemText>
                      </Select.Item>
                      <Select.Item className={styles["mill-select-item"]} value="donkey" disabled={donkeyReason !== null} title={donkeyReason ?? undefined}>
                        <Select.ItemText>Produce with the donkey</Select.ItemText>
                      </Select.Item>
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>;
            })}
          </>
        )}
      </div>
    </div>
  );
}
