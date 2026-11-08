import type { ReactNode } from "react";
import type { FarmSnapshot } from "../../schemas/farm";
import { evaluateProgression } from "../../game-core/farm/progression";
import { storedPlantingBarley } from "../../game-core/farm/batchPlanting";
import FarmLevelIcon from "./FarmLevelIcon";
import FarmerPortrait from "./FarmerPortrait";
import ShekelBalance from "./ShekelBalance";
import BarleyBalance from "./BarleyBalance";
import styles from "../styles/IsometricTest.module.scss";

/** Every game view shares this frame; only centre actions and callbacks vary. */
export default function GameTopBar({ snapshot, clock, children, onLevel, onFarmer, onZoomIn, onZoomOut, onFit, zoomDisabled = false }: {
  readonly snapshot: FarmSnapshot | null; readonly clock: number; readonly children: ReactNode;
  readonly onLevel?: () => void; readonly onFarmer?: () => void;
  readonly onZoomIn: () => void; readonly onZoomOut: () => void; readonly onFit: () => void;
  readonly zoomDisabled?: boolean;
}) {
  const levelProgress = snapshot ? evaluateProgression(snapshot, clock) : null;
  const happiness = snapshot ? Math.round(Math.min(100, Math.max(0, snapshot.farm.household.happiness))) : 0;
  const completedObjectives = levelProgress?.requirements.filter(requirement => requirement.met).length ?? 0;
  return (
    <header className={styles.topBar}>
      <div className={styles.levelControls}>
      <button className={styles.levelSummary} disabled={!snapshot || !onLevel} aria-haspopup="dialog" onClick={onLevel}>
        <FarmLevelIcon level={snapshot?.farm.progression?.level ?? 1} />
        <span className={styles.levelDetails}>
          <strong>Farm level {snapshot?.farm.progression?.level ?? 1}</strong>
          <span>{levelProgress?.upcoming ? "Highest level reached" : `${completedObjectives}/${levelProgress?.requirements.length ?? 0} objectives fulfilled`}</span>
          <span className={styles.levelTrack} role="progressbar" aria-label="Level objectives" aria-valuemin={0} aria-valuemax={levelProgress?.upcoming ? 1 : Math.max(1, levelProgress?.requirements.length ?? 0)} aria-valuenow={levelProgress?.upcoming ? 1 : completedObjectives}>
            <span style={{ width: `${levelProgress?.upcoming ? 100 : 100 * completedObjectives / Math.max(1, levelProgress?.requirements.length ?? 0)}%` }} />
          </span>
        </span>
      </button>
        <div className={styles.zoomControls} role="group" aria-label="Map zoom">
      <button disabled={zoomDisabled} onClick={onZoomIn} aria-label="Zoom in">+</button>
      <button disabled={zoomDisabled} onClick={onZoomOut} aria-label="Zoom out">−</button>
      <button disabled={zoomDisabled} onClick={onFit}>Fit</button>
        </div>
      </div>
    {children}
      {snapshot && <div className={styles.resourceBalanceRow}>
        <ShekelBalance amount={snapshot.player.shekelBalance} />
        <BarleyBalance amount={storedPlantingBarley(snapshot, clock)} />
        <button className={`${styles.happinessCounter} ${styles.happinessShortcut}`} aria-label={onFarmer ? `Open Farmer tab, happiness ${happiness}%` : `Farmer happiness ${happiness}%`} aria-haspopup="dialog" disabled={!onFarmer} onClick={onFarmer}>
          <div className={styles.happinessPortrait} aria-hidden="true"><FarmerPortrait name="Farmer" variant="headshot" /></div>
          <span aria-hidden="true">{happiness}%</span>
        </button>
      </div>}
    </header>
  );
}
