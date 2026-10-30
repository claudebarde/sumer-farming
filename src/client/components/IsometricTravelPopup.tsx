import { Popover } from "radix-ui";
import { TILE_SIZE } from "../game/phaser/config";
import type { IsometricTileAnchor } from "../game/phaser/scenes/IsometricFarmScene";
import styles from "../styles/IsometricTest.module.scss";
import { isometricTradeScope } from "../game/phaser/isometricMarket";
import { marketStandUnlockLevel } from "../../game-data/progression";
import MapCuneiformLabel from "./MapCuneiformLabel";
import BuildingActionIcon from "./BuildingActionIcon";
import actionStyles from "../styles/BuildingActionButton.module.scss";

export default function IsometricTravelPopup({ anchor, available, onClose, onTravel }: {
  anchor: IsometricTileAnchor; available: boolean; onClose: () => void; onTravel: () => void;
}) {
  const returning = anchor.kind === "farmReturn";
  const stand = anchor.kind === "barleyMarket" || anchor.kind === "beerMarket" || anchor.kind === "bakingMarket" || anchor.kind === "produceMarket";
  const scope = isometricTradeScope(anchor.kind);
  const title = anchor.kind === "produceMarket" ? "Fruit and vegetables" : anchor.kind === "bakingMarket" ? "Baking market" : anchor.kind === "beerMarket" ? "Beer market" : anchor.kind === "barleyMarket" ? "Barley market" : returning ? "Farm" : "Market";
  return <Popover.Root open onOpenChange={open => { if (!open) onClose(); }}>
    <Popover.Anchor asChild><span className={styles.popupAnchor} style={{ left: anchor.x, top: anchor.y + 90 }} /></Popover.Anchor>
    <Popover.Portal><Popover.Content key={anchor.kind} className={styles.tilePopup} side="top" sideOffset={8} collisionPadding={12}
      style={{ maxWidth: `min(${TILE_SIZE * 6}px, calc(100vw - 24px))` }} aria-label={title}
      onCloseAutoFocus={event => event.preventDefault()}>
      <div className={styles.popupBody}>
        <div className={styles.popupHeader}><h2><MapCuneiformLabel element={title} /><span>{title}</span></h2></div>
        <Popover.Close className={styles.popupClose} aria-label="Close tile popup"><span aria-hidden="true">×</span></Popover.Close>
        {stand && <p>{scope ? `Unlocks at level ${marketStandUnlockLevel(scope)}.` : "Trading coming soon."}</p>}
        <div className={styles.popupActions}>{!stand && available && <button className={actionStyles.button} onClick={onTravel}>
          <BuildingActionIcon kind="walk" /><span>{returning ? "Go back to the farm" : "Go to the market"}</span>
        </button>}</div>
      </div>
      <Popover.Arrow className={styles.popupArrow} width={20} height={10} />
    </Popover.Content></Popover.Portal>
  </Popover.Root>;
}
