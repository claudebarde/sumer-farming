import type { FarmSnapshot } from "../../schemas/farm";
import TileActionButton from "./TileActionButton";
import { farmerProductionJob } from "../../game-core/farm/farmerProduction";
import {
  SHRINE_OFFERING_QUANTITY,
  shrineBlessingActive
} from "../../game-data/shrine";
import type { FarmerCommandInput } from "../stores/farmerCommandStore";
import type { TilePosition } from "../game/phaser/types";
import styles from "../styles/GameCanvas.module.scss";

export default function ShrineContent({
  snapshot,
  buildingId,
  target,
  now,
  busy,
  addCommand
}: {
  readonly snapshot: FarmSnapshot;
  readonly buildingId: string;
  readonly target: TilePosition;
  readonly now: number;
  readonly busy: boolean;
  readonly addCommand: (command: FarmerCommandInput) => void;
}) {
  const shrine = snapshot.buildings.find(b => b.id === buildingId);
  const blessing = snapshot.farm.production.shrineBlessing;
  const active = shrineBlessingActive(blessing, now);
  const remainingMinutes = active
    ? Math.ceil((Date.parse(blessing!.expiresAt) - now) / 60_000)
    : 0;
  const constructionSeconds = shrine
    ? Math.max(0, Math.ceil((Date.parse(shrine.completesAt) - now) / 1000))
    : 0;
  const unavailable =
    !shrine || constructionSeconds > 0
      ? "The shrine is under construction."
      : (snapshot.farm.progression?.level ?? 1) < 8
        ? "Unlock at level 8."
        : active
          ? "One blessing at a time. Wait until this offering expires."
          : busy ||
              farmerProductionJob(snapshot.farm) ||
              snapshot.farm.carriedItem ||
              snapshot.farm.fishing ||
              snapshot.farm.gathering ||
              snapshot.farm.production.delivery ||
              snapshot.farm.millGoods.delivery
            ? "Finish the current task and empty the farmer’s hands first."
            : null;
  return (
    <div className={styles["tile-popover-content"]}>
      <div className={styles["tile-popover-content-header"]}>Small shrine</div>
      <div className={styles["tile-popover-content-body"]}>
        <p>
          Offer 2 bread or 2 beer: happiness decays 25% more slowly for 12
          hours. Hunger is unchanged.
        </p>
        {constructionSeconds > 0 && (
          <p>
            Construction: {Math.floor(constructionSeconds / 60)}m{" "}
            {constructionSeconds % 60}s remaining.
          </p>
        )}
        {active && (
          <p>
            Blessing: {Math.floor(remainingMinutes / 60)}h{" "}
            {remainingMinutes % 60}m remaining.
          </p>
        )}
        {unavailable && <p>{unavailable}</p>}
        {(["bread", "beer"] as const).map(item => (
          <TileActionButton
            key={item}
            disabled={
              unavailable !== null ||
              (snapshot.inventory.find(i => i.itemKey === item)?.quantity ??
                0) < SHRINE_OFFERING_QUANTITY
            }
            onClick={() =>
              addCommand({
                type: "production",
                action: item === "bread" ? "offerBread" : "offerBeer",
                buildingId,
                target
              })
            }
          >
            Offer {SHRINE_OFFERING_QUANTITY} {item}s
          </TileActionButton>
        ))}
      </div>
    </div>
  );
}
