import { Dialog, Tooltip } from "radix-ui";
import { Cross2Icon } from "@radix-ui/react-icons";
import BuildingActionIcon from "./BuildingActionIcon";
import MusicControls from "./MusicControls";
import DevelopmentPlayerSelector from "./DevelopmentPlayerSelector";
import { useNavigationTooltip } from "./useNavigationTooltip";
import styles from "../styles/IsometricTest.module.scss";
import drawerStyles from "../styles/GameCanvas.module.scss";
import actionStyles from "../styles/BuildingActionButton.module.scss";

/** Settings drawer shares the estate drawer's presentation and focus handling. */
export default function SettingsDrawer({ onOpen, layer }: { readonly onOpen: () => void; readonly layer?: number }) {
  const tooltip = useNavigationTooltip();
  return <Dialog.Root onOpenChange={open => { if (open) onOpen(); }}>
    <Tooltip.Root {...tooltip("settings")}>
      <Tooltip.Trigger asChild>
        <Dialog.Trigger asChild>
          <button className={`${styles.manageButton} ${actionStyles.button} ${styles.manageIconButton}`} aria-label="Settings">
            <BuildingActionIcon kind="settings" /><span className={styles.controlLabel}>Settings</span>
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
      <Dialog.Overlay style={layer === undefined ? undefined : { zIndex: layer }} className={drawerStyles["manage-dialog-overlay"]} />
      <Dialog.Content style={layer === undefined ? undefined : { zIndex: layer + 1 }} className={`${drawerStyles["manage-dialog-content"]} ${drawerStyles["settings-dialog-content"]}`} aria-describedby={undefined}>
        <Dialog.Title>Settings</Dialog.Title>
        <div className={drawerStyles["settings-dialog-body"]}>
          <MusicControls />
          {import.meta.env.DEV && <div className={drawerStyles["settings-test-player"]}><DevelopmentPlayerSelector /></div>}
        </div>
        <Dialog.Close asChild>
          <button className={drawerStyles["manage-dialog-close"]} aria-label="Close settings"><Cross2Icon /></button>
        </Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
