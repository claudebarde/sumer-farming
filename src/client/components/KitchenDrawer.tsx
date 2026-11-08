import RulesLink from "./RulesLink";
import { Dialog } from "radix-ui";
import { Cross2Icon } from "@radix-ui/react-icons";
import type { FarmSnapshot } from "../../schemas/farm";
import type { MealKey } from "../../game-data/kitchen";
import { buildingDemolitionReason } from "../../game-core/farm/buildingDemolition";
import KitchenContent from "./KitchenContent";
import MapCuneiformLabel from "./MapCuneiformLabel";
import BuildingActionIcon from "./BuildingActionIcon";
import drawer from "../styles/GameCanvas.module.scss";
import styles from "../styles/Kitchen.module.scss";
import action from "../styles/BuildingActionButton.module.scss";

export default function KitchenDrawer({ snapshot, buildingId, now, onClose, onCook, onDestroy }: {
  readonly snapshot: FarmSnapshot; readonly buildingId: string; readonly now: number;
  readonly onClose: () => void; readonly onCook: (meal: MealKey) => void; readonly onDestroy: () => void;
}) {
  const canDestroy = buildingDemolitionReason(snapshot, buildingId, now) === null;
  return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className={drawer["manage-dialog-overlay"]} />
      <Dialog.Content className={`${drawer["manage-dialog-content"]} ${styles.drawer}`} aria-describedby={undefined}
        onCloseAutoFocus={event => event.preventDefault()}>
        <header className={styles.drawerHeader}>
          <Dialog.Title><MapCuneiformLabel element="Kitchen" /><span>Kitchen</span></Dialog.Title>
          <RulesLink section="kitchen" />
          <Dialog.Close asChild><button aria-label="Close kitchen"><Cross2Icon /></button></Dialog.Close>
        </header>
        <div className={styles.drawerBody}>
          <KitchenContent snapshot={snapshot} now={now} onCook={onCook} />
          {canDestroy && <button className={`${action.button} ${action.danger} ${styles.destroy}`} onClick={onDestroy}>
            <BuildingActionIcon kind="destroy" /><span>Destroy the building</span>
          </button>}
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
