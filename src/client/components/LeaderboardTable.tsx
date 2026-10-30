import patronBadge from "../../assets/sprite_assets/pngs/v2/isometric-test/badges/ziggurat-patron.png";
import type { LeaderboardResponse } from "../../schemas/leaderboard";
import { LEADERBOARD_METRICS } from "../../schemas/leaderboard";
import { SUMER_CITIES } from "../../game-data/sumer";
import farmerSprite from "../../assets/sprite_assets/pngs/v2/farmer-idle-approved-design.webp";
import harvestingHand from "../../assets/sprite_assets/pngs/v2/isometric-test/icons/optimized/harvest-barley-icon.png";
import levelTenBadge from "../../assets/sprite_assets/pngs/v2/isometric-test/badges/level-10-badge.png";
import FarmerPortrait from "./FarmerPortrait";
import styles from "../styles/Leaderboard.module.scss";
import { Tooltip } from "radix-ui";
import tooltipStyles from "../styles/IsometricTest.module.scss";
import { useNavigationTooltip } from "./useNavigationTooltip";

export default function LeaderboardTable({ board, compact = false }: { readonly board: LeaderboardResponse; readonly compact?: boolean }) {
  const tooltip = useNavigationTooltip();
  const outsideTop = board.self && !board.entries.some(entry => entry.playerId === board.self!.playerId);
  return <Tooltip.Provider delayDuration={300}>
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <caption>{board.scope === "local" ? "Neighbourhood" : "All Sumer"} · Top {Math.min(10, board.total)} of {board.total}</caption>
        <thead><tr><th scope="col">Rank</th><th scope="col">Farmer</th><th scope="col" className={styles.badgesColumn}>Badges</th><th scope="col">{board.metric === "ziggurat" ? "Contribution points" : LEADERBOARD_METRICS[board.metric].label}</th></tr></thead>
        <tbody>{board.entries.map(entry => <tr key={entry.playerId} className={entry.isYou ? styles.you : undefined}>
          <td>{entry.rank}</td>
          <th scope="row"><div className={styles.identity}>
            {compact ? <div className={styles.portrait}><FarmerPortrait name={entry.name} variant="headshot" /></div>
              : <img src={farmerSprite} alt="" width={32} height={48} />}
            <div>{entry.name}{entry.isYou && " (You)"}
              <small>{compact ? `Lvl ${entry.level ?? (board.metric === "level" ? entry.score : "—")}` : `${SUMER_CITIES.find(city => city.id === entry.city)?.name ?? entry.city} · ${entry.neighbourhood}`}</small>
            </div>
          </div></th>
          <td className={styles.badgesColumn}>
            <Tooltip.Root {...tooltip(entry.playerId)}>
              <Tooltip.Trigger asChild>
                <span className={styles.badgeTrigger} tabIndex={0}>
            {(entry.level ?? (board.metric === "level" ? entry.score : 0)) >= 10
              ? <img className={styles.tabletBadge} src={levelTenBadge} alt="Reached estate level 10" draggable={false} />
              : <span className={`${styles.levelBadge} ${styles.beginnerBadge}`} role="img" aria-label="Beginner Farmer">
                  <img src={harvestingHand} alt="" draggable={false} />
                </span>}
                </span>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content className={tooltipStyles.navigationTooltip} side="top" sideOffset={6} collisionPadding={8}>
                  {(entry.level ?? (board.metric === "level" ? entry.score : 0)) >= 10
                    ? "Reached estate level 10" : "Beginner Farmer — Your farming journey has begun."}
                  <Tooltip.Arrow className={tooltipStyles.navigationTooltipArrow} />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
            {entry.zigguratPatron && <Tooltip.Root {...tooltip(`patron-${entry.playerId}`)}>
              <Tooltip.Trigger asChild><span className={styles.badgeTrigger} tabIndex={0}><img className={styles.tabletBadge} src={patronBadge} alt="Ziggurat Patron" draggable={false}/></span></Tooltip.Trigger>
              <Tooltip.Portal><Tooltip.Content className={tooltipStyles.navigationTooltip} side="top" sideOffset={6}>Ziggurat Patron — Top construction contributor.<Tooltip.Arrow className={tooltipStyles.navigationTooltipArrow}/></Tooltip.Content></Tooltip.Portal>
            </Tooltip.Root>}
          </td>
          <td>{entry.score.toLocaleString()}</td>
        </tr>)}</tbody>
      </table>
    </div>
    {board.entries.length === 0 && <p>{board.metric === "ziggurat" ? "No construction contributions yet." : "No farmers are ranked yet."}</p>}
    {outsideTop && board.self && <p className={styles.self}>Your rank: {board.self.rank} of {board.total} · {board.self.score.toLocaleString()} {LEADERBOARD_METRICS[board.metric].label.toLowerCase()}</p>}
  </Tooltip.Provider>;
}
