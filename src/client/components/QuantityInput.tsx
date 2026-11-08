import styles from "../styles/QuantityInput.module.scss";

export default function QuantityInput({ value, min = 0, max, disabled = false, label, onChange }: {
  value: number; min?: number; max: number; disabled?: boolean; label: string; onChange: (value: number) => void;
}) {
  const change = (next: number) => onChange(Math.max(min, Math.min(max, Math.floor(Number.isFinite(next) ? next : min))));
  return <div className={styles.quantity} role="group" aria-label={label}>
    <button type="button" aria-label={`Decrease ${label}`} disabled={disabled || value <= min} onClick={() => change(value - 1)}>−</button>
    <input type="number" aria-label={label} min={min} max={max} step={1} disabled={disabled} value={value}
      onChange={event => change(Number(event.target.value))} />
    <button type="button" aria-label={`Increase ${label}`} disabled={disabled || value >= max} onClick={() => change(value + 1)}>+</button>
  </div>;
}
