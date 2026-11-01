import { Tooltip } from "radix-ui";
import { EyeOpenIcon, EyeClosedIcon } from "@radix-ui/react-icons";
import { useNavigationTooltip } from "./useNavigationTooltip";
import styles from "../styles/IsometricTest.module.scss";

export default function BuildingVisibilityButton({ transparent, onToggle }: { transparent: boolean; onToggle: () => void }) {
  const transparencyTooltip = useNavigationTooltip();
  return (
        <Tooltip.Provider delayDuration={300}><Tooltip.Root {...transparencyTooltip("building-visibility")}>
          <Tooltip.Trigger asChild><button className={styles.popupIconButton} aria-label={transparent ? "Restore building" : "See behind building"}
            aria-pressed={transparent} onClick={onToggle}>
            {transparent ? <EyeClosedIcon width={24} height={24} /> : <EyeOpenIcon width={24} height={24} />}
          </button></Tooltip.Trigger>
          <Tooltip.Portal><Tooltip.Content className={styles.navigationTooltip} side="top" sideOffset={6}>
            {transparent ? "Restore building" : "See behind building"}<Tooltip.Arrow className={styles.navigationTooltipArrow} />
          </Tooltip.Content></Tooltip.Portal>
        </Tooltip.Root></Tooltip.Provider>
  );
}
