import pointsIcon from "../../assets/sprite_assets/pngs/v2/isometric-test/icons/points-tokens-icon.png";
import styles from "../styles/GameCanvas.module.scss";

export default function FarmerPointsCounter({ points }: { readonly points: number }) {
  return <div>
    <div className={styles["farmer-points-value"]}>
      <img src={pointsIcon} alt="" />
      <strong>{points.toLocaleString()}</strong>
    </div>
    <span>Points</span>
  </div>;
}
