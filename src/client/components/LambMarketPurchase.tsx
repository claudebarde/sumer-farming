import { z } from "zod";
import { useRef, useState } from "react";
import { LAMB_PRICE, lambPurchaseLimit, lambDeliveryActive } from "../../game-data/livestock";
import { FarmSnapshotSchema, type FarmSnapshot } from "../../schemas/farm";
import { developmentPlayerHeaders } from "../api/developmentPlayer";
import { farmStore } from "../stores/farmStore";
import { marketUiStore } from "../stores/marketUiStore";
import { randomId } from "../randomId";
import MarketQuantityControl from "./MarketQuantityControl";
import MarketTransactionPreview from "./MarketTransactionPreview";
import BuildingActionIcon from "./BuildingActionIcon";
import actionStyles from "../styles/BuildingActionButton.module.scss";
import styles from "../styles/GameCanvas.module.scss";
import lamb from "../../assets/sprite_assets/pngs/v2/isometric-test/sheep/sheep-lamb-animations/sheep-lamb-lower-01.png";

export default function LambMarketPurchase({ snapshot, now }: { snapshot: FarmSnapshot; now: number }) {
  const [quantity, setQuantity] = useState(1), [pending, setPending] = useState(false), [error, setError] = useState<string | null>(null);
  const attempt = useRef<{ id: string; quantity: number } | null>(null);
  const count = snapshot.farm.production.livestock?.animals.length ?? 0;
  const pen = snapshot.buildings.some(b => b.type === "sheepPen" && Date.parse(b.completesAt) <= now);
  const limit = pen ? lambPurchaseLimit(count, snapshot.player.shekelBalance) : 0;
  const selected = Math.max(1, Math.min(quantity, limit));
  const busy = lambDeliveryActive(snapshot.farm.production.livestock, now);
  const buy = async () => {
    if (pending || !limit || busy) return;
    setPending(true); setError(null);
    const request = attempt.current ?? { id: randomId(), quantity: selected };
    attempt.current = request;
    try {
      const response = await fetch("/api/market/lambs", { method: "POST", headers: { ...developmentPlayerHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: request.quantity, expectedFarmVersion: snapshot.farm.version, idempotencyKey: request.id }) });
      const data = await response.json();
      if (!response.ok) { if (response.status < 500) attempt.current = null; throw new Error(z.object({ error: z.object({ message: z.string() }) }).safeParse(data).data?.error.message ?? "Unable to buy lambs."); }
      farmStore.getState().setReady(FarmSnapshotSchema.parse(data));
      attempt.current = null;
      marketUiStore.getState().setOpen(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to buy lambs."); }
    finally { setPending(false); }
  };
  return <section className={styles["market-item"]} aria-label="Buy lambs">
    <h3><img src={lamb} alt="" width={48} height={48} />Lambs</h3>
    <MarketTransactionPreview showPrice={false} label="Animals" resourceIcon={<img src={lamb} alt="" width={40} height={40} />}
      stock={count} balance={snapshot.player.shekelBalance}
      transaction={limit > 0 ? { type: "buy", quantity: selected, unitPrice: LAMB_PRICE } : undefined} />
    {pen && <p>{count}/3 animals · {3 - count} spaces available</p>}
    <MarketQuantityControl label="Quantity to buy" value={selected} limit={limit} unitPrice={LAMB_PRICE} disabled={pending || !limit || busy} onChange={value => { attempt.current = null; setQuantity(value); }} />
    <div className={styles["market-actions"]}>
      <button className={actionStyles.button} disabled={pending || !limit || busy} onClick={() => void buy()}>
        <BuildingActionIcon kind="shekels" /><span>
          {pending ? "Buying…" : busy ? "Bringing lambs home" : !pen ? "Build a sheep pen first" : count >= 3 ? "Pen is full" : !limit ? "Not enough shekels" : `Buy for ${selected * LAMB_PRICE} shekels`}
        </span>
      </button>
    </div>
    {error && <p className={styles["market-error"]} role="alert">{error}</p>}
  </section>;
}
