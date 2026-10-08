import type { LeaderboardResponse } from "../../schemas/leaderboard";
import { LEADERBOARD_METRICS } from "../../schemas/leaderboard";
import { SUMER_CITIES } from "../../game-data/sumer";
import farmerSprite from "../../assets/sprite_assets/pngs/farmer-stand-staff-1.png";
import styles from "../styles/Leaderboard.module.scss";

export default function LeaderboardTable({ board }: { readonly board: LeaderboardResponse }) {
  const outsideTop = board.self && !board.entries.some(entry => entry.playerId === board.self!.playerId);
  return <>
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <caption>{board.scope === "local" ? "Neighbourhood" : "All Sumer"} · Top {Math.min(10, board.total)} of {board.total}</caption>
        <thead><tr><th scope="col">Rank</th><th scope="col">Farmer</th><th scope="col">{LEADERBOARD_METRICS[board.metric].label}</th></tr></thead>
        <tbody>{board.entries.map(entry => <tr key={entry.playerId} className={entry.isYou ? styles.you : undefined}>
          <td>{entry.rank}</td>
          <th scope="row"><div className={styles.identity}>
            <img src={farmerSprite} alt="" width={32} height={48} />
            <div>{entry.name}{entry.isYou && " (You)"}
              <small>{SUMER_CITIES.find(city => city.id === entry.city)?.name ?? entry.city} · {entry.neighbourhood}</small>
            </div>
          </div></th>
          <td>{entry.score.toLocaleString()}</td>
        </tr>)}</tbody>
      </table>
    </div>
    {board.entries.length === 0 && <p>No farmers are ranked yet.</p>}
    {outsideTop && board.self && <p className={styles.self}>Your rank: {board.self.rank} of {board.total} · {board.self.score.toLocaleString()} {LEADERBOARD_METRICS[board.metric].label.toLowerCase()}</p>}
  </>;
}
