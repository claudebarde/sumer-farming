import type { FarmSnapshot } from "../../schemas/farm";
import { useContext, useRef, useState } from "react";
import {
  activeBuildingUpgrade,
  buildingLevel,
  BUILDING_UPGRADES
} from "../../game-data/buildingUpgrades";
import { buildingUpgradeUnavailableReason } from "../../game-core/farm/buildingUpgrades";
import { executeGameCommand } from "../api/gameActions";
import { farmStore } from "../stores/farmStore";
import TileActionButton from "./TileActionButton";
import { TileActionsBusy } from "./tileActionsBusy";
import { Select } from "radix-ui";
import { ChevronDownIcon } from "@radix-ui/react-icons";
import type { TilePosition } from "../game/phaser/types";
import type { FarmerCommandInput } from "../stores/farmerCommandStore";
import {
  MILL_RECIPES,
  millRecipe,
  type MillRecipe
} from "../../game-data/milling";
import { millingUnavailableReason } from "../../game-core/farm/milling";
import styles from "../styles/GameCanvas.module.scss";

export default function MillContent({
  buildingId,
  snapshot,
  target,
  now,
  addCommand
}: {
  readonly buildingId?: string;
  readonly snapshot: FarmSnapshot;
  readonly target: TilePosition;
  readonly now: number;
  readonly addCommand: (command: FarmerCommandInput) => void;
}) {
  const id =
    buildingId ??
    snapshot.buildings.find(b => b.type === "mill")?.id ??
    snapshot.farm.milling?.buildingId ??
    "";
  const exists = snapshot.buildings.some(b => b.id === id);
  const job =
    snapshot.farm.milling?.buildingId === id ? snapshot.farm.milling : null;
  const upgrades = snapshot.farm.production.buildingUpgrades;
  const level = buildingLevel(upgrades, id, now);
  const upgrading = activeBuildingUpgrade(upgrades, id, now);
  const nextUpgrade = exists ? BUILDING_UPGRADES.mill?.[level + 1] : undefined;
  const upgradeReason = buildingUpgradeUnavailableReason(snapshot, id, now);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<{ key: string; level: number } | null>(null);
  const upgrade = async () => {
    if (pending || upgradeReason) return;
    setPending(true);
    setError(null);
    request.current ??= { key: crypto.randomUUID(), level: level + 1 };
    try {
      const updated = await executeGameCommand({
        type: "upgrade_building",
        buildingId: id,
        targetLevel: request.current.level,
        idempotencyKey: request.current.key,
        expectedFarmVersion: snapshot.farm.version
      });
      farmStore.getState().setReady(updated);
      request.current = null;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not upgrade the Mill.");
    } finally {
      setPending(false);
    }
  };
  const durationLabel = (ms: number) =>
    `${Math.floor(ms / 60000)}m ${Math.floor(ms / 1000) % 60}s`;
  const busy = useContext(TileActionsBusy);
  const remainingSeconds = job
    ? Math.max(0, Math.ceil((Date.parse(job.completesAt) - now) / 1000))
    : 0;
  const ownsDonkey = snapshot.inventory.some(
    i => i.itemKey === "donkey" && i.quantity > 0
  );
  const hasWorkerChoice =
    (snapshot.farm.progression?.level ?? 1) >= 7 && ownsDonkey;
  return (
    <div className={styles["tile-popover-content"]}>
      <div className={styles["tile-popover-content-header"]}>
        <span className="cuneiforms">𒂍𒄯</span>
        Mill
        <span
          className={styles["building-level-sign"]}
          aria-label={`Building level ${level}`}
        >
          Lv. {level}
        </span>
      </div>
      <div className={styles["tile-popover-content-body"]}>
        {upgrading ? (
          <>
            <p>
              Upgrading to level {upgrading.level} · Production unavailable.
            </p>
            <p>
              {durationLabel(
                Math.max(0, Date.parse(upgrading.completesAt) - now)
              )}{" "}
              remaining
            </p>
            <progress
              aria-label="Building upgrade progress"
              max={100}
              value={Math.min(
                100,
                Math.max(
                  0,
                  ((now - Date.parse(upgrading.startedAt)) /
                    (Date.parse(upgrading.completesAt) -
                      Date.parse(upgrading.startedAt))) *
                    100
                )
              )}
            />
          </>
        ) : job ? (
          <>
            <p>
              {job.worker === "donkey" ? "The donkey" : "The farmer"} is
              producing {job.output} {MILL_RECIPES[job.recipe].label}.
              {job.worker === "donkey"
                ? " The farmer is free to work elsewhere."
                : " He is unavailable until milling finishes."}
            </p>
            <p>
              {Math.floor(remainingSeconds / 60)}m {remainingSeconds % 60}s
              remaining.
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
              Process barley into Flour or Brewer's Groats.
              {hasWorkerChoice && " Choose who does the work."}
            </p>
            <table className={styles["mill-recipe-table"]}>
              <caption>Per batch · flour or groats</caption>
              <thead>
                <tr>
                  <th scope="col">Worker</th>
                  <th scope="col">Barley</th>
                  <th scope="col">Bags</th>
                  <th scope="col">Time</th>
                </tr>
              </thead>
              <tbody>
                {(["farmer", "donkey"] as const)
                  .filter(worker => worker === "farmer" || hasWorkerChoice)
                  .map(worker => {
                    const recipe = millRecipe("flour", worker, level);
                    return (
                      <tr key={worker}>
                        <th scope="row">
                          {worker === "farmer" ? "Farmer" : "Donkey"}
                        </th>
                        <td>{recipe.barley}</td>
                        <td>{recipe.output}</td>
                        <td>
                          {recipe.durationMs % 60000 === 0
                            ? `${recipe.durationMs / 60000} min`
                            : durationLabel(recipe.durationMs)}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
            {millingUnavailableReason(snapshot, "flour", now, "farmer", id) && (
              <p>
                {millingUnavailableReason(snapshot, "flour", now, "farmer", id)}
              </p>
            )}
            {/* {hasWorkerChoice &&
              millingUnavailableReason(
                snapshot,
                "flour",
                now,
                "donkey",
                id
              ) && (
                <p>
                  {millingUnavailableReason(
                    snapshot,
                    "flour",
                    now,
                    "donkey",
                    id
                  )}
                </p>
              )} */}
            {/* {nextUpgrade && <p>Next level: {Math.round((1 - nextUpgrade.productionTimeMultiplier) * 100)}% shorter milling · {durationLabel(nextUpgrade.durationMs)} to upgrade.</p>} */}
            {nextUpgrade && upgradeReason && <p>{upgradeReason}</p>}
            {error && <p role="alert">{error}</p>}
            {(Object.keys(MILL_RECIPES) as MillRecipe[]).map(recipe => {
              const farmerReason = millingUnavailableReason(
                snapshot,
                recipe,
                now,
                "farmer",
                id
              );
              const donkeyReason = millingUnavailableReason(
                snapshot,
                recipe,
                now,
                "donkey",
                id
              );
              const label =
                recipe === "flour" ? "Produce flour" : "Produce groats";
              if (!hasWorkerChoice || busy)
                return (
                  <TileActionButton
                    key={recipe}
                    disabled={farmerReason !== null}
                    onClick={() =>
                      addCommand({
                        type: "mill",
                        target,
                        recipe,
                        worker: "farmer"
                      })
                    }
                  >
                    {label}
                  </TileActionButton>
                );
              return (
                <Select.Root
                  key={recipe}
                  value=""
                  disabled={farmerReason !== null && donkeyReason !== null}
                  onValueChange={worker => {
                    if (
                      (worker === "farmer" || worker === "donkey") &&
                      millingUnavailableReason(
                        snapshot,
                        recipe,
                        now,
                        worker,
                        id
                      ) === null
                    )
                      addCommand({ type: "mill", target, recipe, worker });
                  }}
                >
                  <Select.Trigger
                    className={styles["mill-select-trigger"]}
                    aria-label={label}
                  >
                    <Select.Value placeholder={label} />
                    <Select.Icon>
                      <ChevronDownIcon />
                    </Select.Icon>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content
                      className={styles["mill-select-content"]}
                      position="popper"
                      sideOffset={4}
                      collisionPadding={12}
                    >
                      <Select.Viewport>
                        <Select.Item
                          className={styles["mill-select-item"]}
                          value="farmer"
                          disabled={farmerReason !== null}
                          title={farmerReason ?? undefined}
                        >
                          <Select.ItemText>
                            Produce with the farmer
                          </Select.ItemText>
                        </Select.Item>
                        <Select.Item
                          className={styles["mill-select-item"]}
                          value="donkey"
                          disabled={donkeyReason !== null}
                          title={donkeyReason ?? undefined}
                        >
                          <Select.ItemText>
                            Produce with the donkey
                          </Select.ItemText>
                        </Select.Item>
                      </Select.Viewport>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
              );
            })}
            {exists && (
              <TileActionButton
                disabled={pending || upgradeReason !== null}
                onClick={() => void upgrade()}
              >
                {!nextUpgrade
                  ? "Maximum level"
                  : (snapshot.farm.progression?.level ?? 1) < nextUpgrade.estateLevel
                    ? `Level ${level + 1} · Unlock at estate level ${nextUpgrade.estateLevel}`
                  : pending
                    ? "Upgrading…"
                    : `Upgrade to level ${level + 1} · ${nextUpgrade.cost} shekels`}
              </TileActionButton>
            )}
          </>
        )}
      </div>
    </div>
  );
}
