import { Dialog, Tooltip } from "radix-ui";
import { Cross2Icon } from "@radix-ui/react-icons";
import BuildingActionIcon from "./BuildingActionIcon";
import MusicControls from "./MusicControls";
import { useNavigationTooltip } from "./useNavigationTooltip";
import styles from "../styles/IsometricTest.module.scss";
import drawerStyles from "../styles/GameCanvas.module.scss";
import actionStyles from "../styles/BuildingActionButton.module.scss";

/** Settings drawer shares the estate drawer's presentation and focus handling. */
export default function SettingsDrawer({ onOpen }: { readonly onOpen: () => void }) {
  const tooltip = useNavigationTooltip();
  return <Dialog.Root onOpenChange={open => { if (open) onOpen(); }}>
    <Tooltip.Root {...tooltip("settings")}>
      <Tooltip.Trigger asChild>
        <Dialog.Trigger asChild>
          <button className={`${styles.manageButton} ${actionStyles.button} ${styles.manageIconButton}`} aria-label="Settings">
            <BuildingActionIcon kind="settings" />
          </button>
        </Dialog.Trigger>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className={styles.navigationTooltip} side="bottom" sideOffset={6} collisionPadding={8}>
          Open settings<Tooltip.Arrow className={styles.navigationTooltipArrow} />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
    <Dialog.Portal>
      <Dialog.Overlay className={drawerStyles["manage-dialog-overlay"]} />
      <Dialog.Content className={drawerStyles["manage-dialog-content"]} aria-describedby={undefined}>
        <Dialog.Title>Settings</Dialog.Title>
        <MusicControls />
        <Dialog.Close asChild>
          <button className={drawerStyles["manage-dialog-close"]} aria-label="Close settings"><Cross2Icon /></button>
        </Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
