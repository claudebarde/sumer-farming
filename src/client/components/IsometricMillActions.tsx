import type { FarmSnapshot } from "../../schemas/farm";
import type { MillRecipe } from "../../game-data/milling";
import { millPopupState } from "../game/phaser/isometricMilling";

export default function IsometricMillActions({ snapshot, buildingId, now, onMill }: {
  readonly snapshot: FarmSnapshot; readonly buildingId: string; readonly now: number;
  readonly onMill: (recipe: MillRecipe) => void;
}) {
  const state = millPopupState(snapshot, buildingId, now);
  if (state.insufficient) return <button disabled>You don't have enough barley</button>;
  const groats = millPopupState(snapshot, buildingId, now, "brewersGroats");
  return <>{state.canStart && <button onClick={() => onMill("flour")}>Make flour (for bread)</button>}{groats.canStart && <button onClick={() => onMill("brewersGroats")}>Make groats (for beer)</button>}</>;
}
