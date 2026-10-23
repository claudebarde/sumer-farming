import { FARM_SPRITES } from "../../assets/farmSprites";
import styles from "../styles/IsometricTest.module.scss";

export default function BarleyBalance({ amount }: { readonly amount: number }) {
  return <div className={styles.shekelBalance} aria-label={`${amount} barley stored in the estate`}>
    <img className={styles.barleyBalanceIcon} src={FARM_SPRITES.harvestedBarley} width={36} height={36} alt="" draggable={false} />
    <span>{amount}</span>
  </div>;
}
