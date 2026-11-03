import InfoAlert from "./InfoAlert";
import { millingBarleyAvailable, millingUnavailableReason } from "../../game-core/farm/milling";
import { millStorageAvailable } from "../../game-core/farm/millStorage";
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
  if (millingJobForBuilding(snapshot.farm, buildingId)) return null;
  if (!productionOutputFits(snapshot.farm, buildingId, millRecipe(oil ? "oil" : "flour").output)) return <button disabled>{OUTPUT_FULL_MESSAGE}</button>;
  const ingredients = oil ? snapshot.inventory.find(i => i.itemKey === "sesame")?.quantity ?? 0 : millingBarleyAvailable(snapshot, now);
  const inspectable = (recipe: MillRecipe) => {
    const reason = millingUnavailableReason(snapshot, recipe, now, "farmer", buildingId);
    return millPopupState(snapshot, buildingId, now, recipe).canStart ||
      reason === "Not enough sesame." || reason === "Bring barley or store it in the farm or a completed granary." || reason === "No storage space";
  };
  const storageMessage = (recipe: MillRecipe) => {
    const room = millStorageAvailable(snapshot, recipe, now);
    const donkeyOwned = snapshot.inventory.some(i => i.itemKey === "donkey" && i.quantity > 0);
    const needed = millRecipe(recipe, donkeyOwned ? "donkey" : "farmer").output;
    if (room >= needed) return null;
    const item = recipe === "oil" ? "oil" : recipe === "flour" ? "flour" : "groats";
    return `Not enough ${item} storage for ${room < 1 ? "a batch" : "the donkey batch"}: only ${room} ${room === 1 ? "space" : "spaces"} available.`;
  };
  return <>{(oil ? [{ recipe: "oil", icon: "oil", label: "Make oil", available: inspectable("oil") }] as const : [
    { recipe: "flour", icon: "flour", label: "Make flour (for bread)", available: inspectable("flour") },
    { recipe: "brewersGroats", icon: "groats", label: "Make groats (for beer)", available: inspectable("brewersGroats") }
  ] as const).filter(action => action.available).map(({ recipe, icon, label }) =>
    <Select.Root key={recipe} value="" onValueChange={worker => {
      if ((worker === "farmer" || worker === "donkey") && millPopupState(snapshot, buildingId, now, recipe, worker).canStart) onMill(recipe, worker);
    }}>
      {storageMessage(recipe) && <InfoAlert>{storageMessage(recipe)}</InfoAlert>}
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
              const missingIngredient = ingredients < (oil ? batch.output * 3 : batch.barley);
              const costLabel = oil
                ? `${batch.output * 3} sesame baskets and ${batch.output} empty ${batch.output === 1 ? "jar" : "jars"}`
                : `${batch.barley} barley`;
              return <Select.Item key={worker} className={`${popupStyles["mill-select-item"]} ${popupStyles["mill-select-cost-item"]}`} value={worker}
                textValue={`With the ${worker}`}
                aria-label={`With the ${worker}, costs ${costLabel}${missingIngredient ? `, not enough ${oil ? "sesame" : "barley"}` : ""}`}
                disabled={!millPopupState(snapshot, buildingId, now, recipe, worker).canStart}>
                <Select.ItemText>{`With the ${worker}`}</Select.ItemText>
                <span className={popupStyles["mill-select-cost"]} aria-hidden="true">
                  {oil ? <>
                    <span><span className={popupStyles["mill-ingredient-icon"]}><MarketItemIcon itemKey="sesame" />{missingIngredient && <span className={popupStyles["mill-ingredient-unavailable"]} />}</span>{batch.output * 3}</span>
                    <span><MarketItemIcon itemKey="emptyBeerJar" />{batch.output}</span>
                  </> : <span><span className={popupStyles["mill-ingredient-icon"]}><MarketItemIcon itemKey="barley" />{missingIngredient && <span className={popupStyles["mill-ingredient-unavailable"]} />}</span>{batch.barley}</span>}
                </span>
              </Select.Item>;
            })}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )}</>;
}
