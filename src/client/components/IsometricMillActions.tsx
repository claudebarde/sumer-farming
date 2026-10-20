import type { FarmSnapshot } from "../../schemas/farm";
import type { MillRecipe, MillWorker } from "../../game-data/milling";
import { millingUnavailableReason } from "../../game-core/farm/milling";
import { millPopupState } from "../game/phaser/isometricMilling";
import { productionOutputFits, OUTPUT_FULL_MESSAGE } from "../../game-core/farm/productionOutputCapacity";
import { millRecipe } from "../../game-data/milling";
import MillActionIcon from "./BuildingActionIcon";
import styles from "../styles/BuildingActionButton.module.scss";
import { Select } from "radix-ui";
import { ChevronDownIcon } from "@radix-ui/react-icons";
import popupStyles from "../styles/GameCanvas.module.scss";

export default function IsometricMillActions({ snapshot, buildingId, now, onMill }: {
  readonly snapshot: FarmSnapshot; readonly buildingId: string; readonly now: number;
  readonly onMill: (recipe: MillRecipe, worker: MillWorker) => void;
}) {
  const state = millPopupState(snapshot, buildingId, now);
  if (snapshot.farm.milling) return null;
  if (!productionOutputFits(snapshot.farm, buildingId, millRecipe("flour").output)) return <button disabled>{OUTPUT_FULL_MESSAGE}</button>;
  if (state.insufficient) return <button disabled>You don't have enough barley</button>;
  const groats = millPopupState(snapshot, buildingId, now, "brewersGroats");
  return <>{([
    { recipe: "flour", icon: "flour", label: "Make flour (for bread)", available: state.canStart },
    { recipe: "brewersGroats", icon: "groats", label: "Make groats (for beer)", available: groats.canStart }
  ] as const).filter(action => action.available).map(({ recipe, icon, label }) =>
    <Select.Root key={recipe} value="" onValueChange={worker => {
      if ((worker === "farmer" || worker === "donkey") && millPopupState(snapshot, buildingId, now, recipe, worker).canStart) onMill(recipe, worker);
    }}>
      <Select.Trigger className={`${popupStyles["mill-select-trigger"]} ${styles.button}`} aria-label={label}>
        <MillActionIcon kind={icon} />
        <Select.Value placeholder={label} />
        <Select.Icon style={{ marginLeft: "auto" }}><ChevronDownIcon /></Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className={popupStyles["mill-select-content"]} position="popper" sideOffset={4} collisionPadding={12}>
          <Select.Viewport>
            <Select.Item className={popupStyles["mill-select-item"]} value="farmer">
              <Select.ItemText>Produce with the farmer</Select.ItemText>
            </Select.Item>
            <Select.Item className={popupStyles["mill-select-item"]} value="donkey"
              disabled={!millPopupState(snapshot, buildingId, now, recipe, "donkey").canStart}
              title={millingUnavailableReason(snapshot, recipe, now, "donkey", buildingId) ?? undefined}>
              <Select.ItemText>Produce with the donkey</Select.ItemText>
            </Select.Item>
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )}</>;
}
