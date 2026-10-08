import defaultFarmerSprite from "../../assets/sprite_assets/pngs/farmer-stand-staff-1.png";
import styles from "../styles/GameCanvas.module.scss";

/** Shared portrait presentation; future appearance choices can supply a sprite. */
export default function FarmerPortrait({ name, src = defaultFarmerSprite }: {
  readonly name: string;
  readonly src?: string;
}) {
  return <img className={styles["farmer-portrait"]} src={src}
    alt={`${name}, your farmer`} width={96} height={96} draggable={false} />;
}
