import type { ingredientCollection } from "../game/ingredientCollection";
import styles from "../styles/IsometricTest.module.scss";

export default function IngredientCollectionStatus({ status }: {
  status: NonNullable<ReturnType<typeof ingredientCollection>>;
}) {
  return <div className={styles.sowingProgress}>
    <img className={styles.barleyWorkIcon} src={status.icon} alt="" width={48} height={48} draggable={false} />
    <section><p role="status">{status.label}</p></section>
  </div>;
}
