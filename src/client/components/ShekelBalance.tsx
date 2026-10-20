import shekels from "../../assets/sprite_assets/pngs/shekels.png";
import styles from "../styles/IsometricTest.module.scss";

export default function ShekelBalance({ amount }: { readonly amount: number }) {
  return <div className={styles.shekelBalance} aria-label={`${amount} shekels`}>
    <img src={shekels} width={36} height={36} alt="" draggable={false} />
    <span>{amount}</span>
  </div>;
}
