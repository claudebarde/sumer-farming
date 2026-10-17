import type { FarmSnapshot } from "../../schemas/farm";
import type { MillRecipe } from "../../game-data/milling";
import { millPopupState } from "../game/phaser/isometricMilling";
import { productionOutputFits, OUTPUT_FULL_MESSAGE } from "../../game-core/farm/productionOutputCapacity";
import { millRecipe } from "../../game-data/milling";
import MillActionIcon from "./BuildingActionIcon";
import styles from "../styles/BuildingActionButton.module.scss";

export default function IsometricMillActions({ snapshot, buildingId, now, onMill }: {
  readonly snapshot: FarmSnapshot; readonly buildingId: string; readonly now: number;
  readonly onMill: (recipe: MillRecipe) => void;
}) {
  const state = millPopupState(snapshot, buildingId, now);
  if (!productionOutputFits(snapshot.farm, buildingId, millRecipe("flour").output)) return <button disabled>{OUTPUT_FULL_MESSAGE}</button>;
  if (state.insufficient) return <button disabled>You don't have enough barley</button>;
  const groats = millPopupState(snapshot, buildingId, now, "brewersGroats");
  return <>{state.canStart && <button className={styles.button} onClick={() => onMill("flour")}><MillActionIcon kind="flour" /><span>Make flour (for bread)</span></button>}{groats.canStart && <button className={styles.button} onClick={() => onMill("brewersGroats")}><MillActionIcon kind="groats" /><span>Make groats (for beer)</span></button>}</>;
}
