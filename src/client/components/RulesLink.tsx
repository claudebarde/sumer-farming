import guideIcon from '../../assets/sprite_assets/pngs/v2/isometric-test/icons/guide-scribe.png';
import { Tooltip } from 'radix-ui';
import { rulesHref } from '../features/rules/links';
import { useNavigationTooltip } from './useNavigationTooltip';
import styles from '../styles/IsometricTest.module.scss';
import actionStyles from '../styles/BuildingActionButton.module.scss';
import linkStyles from '../features/rules/RulesLink.module.scss';

export default function RulesLink({ section, toolbar = false }: { section?: string; toolbar?: boolean }) {
  const tooltip = useNavigationTooltip();
  return <Tooltip.Provider delayDuration={300}><Tooltip.Root {...tooltip('rules')}>
    <Tooltip.Trigger asChild><a href={rulesHref(section)} target="_blank" rel="noopener noreferrer" aria-label="Read the Guide"
      className={toolbar ? `${styles.manageButton} ${actionStyles.button} ${styles.manageIconButton} ${linkStyles.toolbar}` : `${styles.popupIconButton} ${linkStyles.icon}`}>
      <img className={linkStyles.artwork} src={guideIcon} width={toolbar ? 40 : 28} height={toolbar ? 40 : 28} alt="" draggable={false} />{toolbar && <span className={styles.controlLabel}>Guide</span>}
    </a></Tooltip.Trigger>
    <Tooltip.Portal><Tooltip.Content className={styles.navigationTooltip} side={toolbar ? 'bottom' : 'top'} sideOffset={6}>
      Read the Guide<Tooltip.Arrow className={styles.navigationTooltipArrow} />
    </Tooltip.Content></Tooltip.Portal>
  </Tooltip.Root></Tooltip.Provider>;
}
