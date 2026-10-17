import { FARM_SPRITES } from "../../assets/farmSprites";
import { granaryCapacityForLevel } from "../../game-data/storage";
import styles from "../styles/BuildingStorageGrid.module.scss";

export default function GranaryStorageCard({ quantity, farmLevel }: { quantity: number; farmLevel: number }) {
  const capacity = granaryCapacityForLevel(farmLevel);
  return <div className={`${styles.card} ${styles.horizontalCard}`} aria-label="Granary inventory">
    <img src={FARM_SPRITES.harvestedBarley} alt="" width={64} height={64} draggable={false} />
    <div className={styles.storageInformation}>
      <div className={styles.itemHeading}>
        <span className={styles.name}>Barley</span>
        <span className={styles.quantity}>{quantity}/{capacity}</span>
      </div>
      <progress value={Math.min(quantity, capacity)} max={capacity} aria-label="Barley storage" aria-valuetext={`${quantity} of ${capacity}`} />
    </div>
  </div>;
}
