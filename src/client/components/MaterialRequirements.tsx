import styles from "../styles/BuildingRequirements.module.scss";

export type MaterialRequirement = {
  readonly name: string; readonly image: string; readonly quantity: number; readonly required: number;
};

export default function MaterialRequirements({ items, label, compact = false }: {
  readonly items: readonly MaterialRequirement[]; readonly label: string; readonly compact?: boolean;
}) {
  return <ul className={`${styles.materials} ${compact ? styles.compact : ""}`} aria-label={label}>
    {items.map(({ name, image, quantity, required }) => <li key={name} className={styles.row} data-ready={quantity >= required}>
      <img src={image} alt="" width={compact ? 28 : 40} height={compact ? 28 : 40} draggable={false} />
      <span className={styles.name}>{name}</span>
      <span className={styles.quantity}>{quantity}/{required}</span>
      <progress value={Math.min(quantity, required)} max={required} aria-label={name}
        aria-valuetext={`${quantity} of ${required} available`} />
    </li>)}
  </ul>;
}
