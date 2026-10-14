import defaultFarmerSprite from "../../assets/sprite_assets/pngs/v2/farmer-idle-approved-design.png";
import styles from "../styles/GameCanvas.module.scss";

/** Shared portrait presentation; future appearance choices can supply a sprite. */
export default function FarmerPortrait({ name, src = defaultFarmerSprite, variant = "full" }: {
  readonly name: string;
  readonly src?: string;
  readonly variant?: "full" | "headshot";
}) {
  if (variant === "headshot") return <div className={styles["farmer-headshot"]}>
    <img src={src} alt={`${name}, head-and-shoulders portrait`} draggable={false} />
  </div>;
  return <img className={styles["farmer-portrait"]} src={src}
    alt={`${name}, your farmer`} width={96} height={96} draggable={false} />;
}
