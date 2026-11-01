import MarketItemIcon from "./MarketItemIcon";
import { millingJobForBuilding } from "../../game-data/millingJobs";
import type { FarmSnapshot } from "../../schemas/farm";
import type { MillRecipe, MillWorker } from "../../game-data/milling";
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
  const oil = snapshot.buildings.find(b => b.id === buildingId)?.type === "oilMill";
  const state = millPopupState(snapshot, buildingId, now, oil ? "oil" : "flour");
  if (millingJobForBuilding(snapshot.farm, buildingId)) return null;
  if (!productionOutputFits(snapshot.farm, buildingId, millRecipe(oil ? "oil" : "flour").output)) return <button disabled>{OUTPUT_FULL_MESSAGE}</button>;
  if (state.insufficient) return <button disabled>{oil ? "Not enough sesame" : "You don't have enough barley"}</button>;
  const groats = millPopupState(snapshot, buildingId, now, "brewersGroats");
  return <>{(oil ? [{ recipe: "oil", icon: "oil", label: "Make oil", available: state.canStart }] as const : [
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
            {(["farmer", "donkey"] as const).map(worker => {
              const batch = millRecipe(recipe, worker);
              const costLabel = oil
                ? `${batch.output * 3} sesame baskets and ${batch.output} empty ${batch.output === 1 ? "jar" : "jars"}`
                : `${batch.barley} barley`;
              return <Select.Item key={worker} className={`${popupStyles["mill-select-item"]} ${popupStyles["mill-select-cost-item"]}`} value={worker}
                textValue={`With the ${worker}`}
                aria-label={`With the ${worker}, costs ${costLabel}`}
                disabled={!millPopupState(snapshot, buildingId, now, recipe, worker).canStart}>
                <Select.ItemText>{`With the ${worker}`}</Select.ItemText>
                <span className={popupStyles["mill-select-cost"]} aria-hidden="true">
                  {oil ? <>
                    <span><MarketItemIcon itemKey="sesame" />{batch.output * 3}</span>
                    <span><MarketItemIcon itemKey="emptyBeerJar" />{batch.output}</span>
                  </> : <span><MarketItemIcon itemKey="barley" />{batch.barley}</span>}
                </span>
              </Select.Item>;
            })}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )}</>;
}
