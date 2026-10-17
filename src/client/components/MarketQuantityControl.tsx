import { useId } from "react";
import { clampMarketQuantity } from "../game/marketQuantity";
import styles from "../styles/MarketTrade.module.scss";

export default function MarketQuantityControl({ label, value, limit, disabled, onChange, unitPrice, priceLabel = "Price per item" }: {
  label: string; value: number; limit?: number; disabled: boolean; onChange: (quantity: number) => void;
  unitPrice?: number; priceLabel?: string;
}) {
  const id = useId();
  const change = (quantity: number) => onChange(clampMarketQuantity(quantity, limit));
  return <div className={styles.controlsRow}><div className={styles.quantity}>
    <label htmlFor={id}>{label}</label>
    <div className={styles.stepper}>
      <button type="button" aria-label={`Decrease ${label.toLowerCase()}`} disabled={disabled || value <= 1} onClick={() => change(value - 1)}>−</button>
      <input id={id} type="number" min={1} max={limit} step={1} value={value} disabled={disabled}
        onChange={event => change(Number(event.currentTarget.value))} />
      <button type="button" aria-label={`Increase ${label.toLowerCase()}`} disabled={disabled || (limit !== undefined && value >= limit)} onClick={() => change(value + 1)}>+</button>
    </div>
  </div>
    {unitPrice !== undefined && <div className={styles.compactPrice}>
      <span>{priceLabel}</span><strong>{unitPrice} {unitPrice === 1 ? "shekel" : "shekels"} <small>each</small></strong>
    </div>}
  </div>;
}
