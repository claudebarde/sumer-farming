import RulesLink from "./RulesLink";
import { Dialog } from "radix-ui";
import { Cross2Icon } from "@radix-ui/react-icons";
import type { FarmSnapshot } from "../../schemas/farm";
import type { MealKey } from "../../game-data/kitchen";
import KitchenContent from "./KitchenContent";
import MapCuneiformLabel from "./MapCuneiformLabel";
import drawer from "../styles/GameCanvas.module.scss";
import styles from "../styles/Kitchen.module.scss";

export default function KitchenDrawer({ snapshot, now, onClose, onCook, layer, pending, error }: {
  readonly snapshot: FarmSnapshot; readonly now: number;
  readonly onClose: () => void; readonly onCook: (meal: MealKey) => void; readonly layer?: number; readonly pending?: boolean; readonly error?: string | null;
}) {
  return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay style={layer ? { zIndex: layer } : undefined} className={drawer["manage-dialog-overlay"]} />
      <Dialog.Content style={layer ? { zIndex: layer + 1 } : undefined} className={`${drawer["manage-dialog-content"]} ${styles.drawer}`} aria-describedby={undefined}
        onCloseAutoFocus={event => event.preventDefault()}>
        <header className={styles.drawerHeader}>
          <Dialog.Title><MapCuneiformLabel element="Kitchen" /><span>Kitchen</span></Dialog.Title>
          <RulesLink section="kitchen" />
          <Dialog.Close asChild><button aria-label="Close kitchen"><Cross2Icon /></button></Dialog.Close>
        </header>
        <div className={styles.drawerBody}>
          {error && <p role="alert">{error}</p>}
          <KitchenContent pending={pending} snapshot={snapshot} now={now} onCook={onCook} />

        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
