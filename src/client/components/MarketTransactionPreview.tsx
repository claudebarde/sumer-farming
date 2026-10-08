type Props = {
  readonly label: string;
  readonly stock: number;
  readonly balance: number;
  readonly transaction?: {
    readonly type: "buy" | "sell" | "listing";
    readonly quantity: number;
    readonly unitPrice: number;
  };
};

const shekels = (amount: number) => `${amount} ${amount === 1 ? "shekel" : "shekels"}`;

/** Presentation only: server validation remains authoritative for every trade. */
export default function MarketTransactionPreview({ label, stock, balance, transaction }: Props) {
  const cost = transaction ? transaction.quantity * transaction.unitPrice : 0;
  const nextStock = transaction ? stock + (transaction.type === "buy" ? transaction.quantity : -transaction.quantity) : stock;
  const nextBalance = transaction?.type === "buy" ? balance - cost : transaction?.type === "sell" ? balance + cost : balance;
  const insufficient = nextStock < 0 || nextBalance < 0;
  return (
    <div aria-live="polite" aria-atomic="true">
      <p>You have {stock} {label} / {shekels(balance)}</p>
      {transaction && (insufficient ? (
        <p>After the transaction: unavailable — {nextStock < 0 ? "not enough stock" : "not enough shekels"}.</p>
      ) : (
        <>
          <p>{transaction.type === "listing" ? "After creating the listing" : "After the transaction"}: {nextStock} {label} / {shekels(nextBalance)}</p>
          {transaction.type === "listing" && <p>Listed goods are reserved. If all sell: {shekels(balance + cost)}.</p>}
        </>
      ))}
    </div>
  );
}
