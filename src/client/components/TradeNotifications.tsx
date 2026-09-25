import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Toast } from "radix-ui";
import { Cross2Icon } from "@radix-ui/react-icons";
import { useStore } from "zustand";
import { fetchTradeHistory } from "../api/tradeHistory";
import { collectNewTrades } from "../features/market/tradeNotifications";
import { farmStore } from "../stores/farmStore";
import { notificationStore, type TradeNotification } from "../stores/notificationStore";
import styles from "../styles/TradeNotifications.module.scss";
import { MARKET_ITEM_DEFINITIONS } from "../../game-data/marketItems";

function TradeToast({ trade }: { readonly trade: TradeNotification }) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (open) return;
    // Animation end normally removes the toast. This also handles reduced
    // motion or a browser that does not deliver the animation event.
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 250;
    const timer = window.setTimeout(() => notificationStore.getState().dismiss(trade.id), delay);
    return () => window.clearTimeout(timer);
  }, [open, trade.id]);

  return (
    <Toast.Root
      className={styles.toast}
      type="background"
      open={open}
      onOpenChange={setOpen}
      onAnimationEnd={event => {
        if (!open && event.target === event.currentTarget) {
          notificationStore.getState().dismiss(trade.id);
        }
      }}
      onPointerDown={event => event.stopPropagation()}
      onPointerUp={event => event.stopPropagation()}
    >
      <Toast.Title className={styles.title}>
        {trade.type === "request_reward" ? "Request delivered" : trade.type === "market_sale" ? "Sale completed" : "Purchase completed"}
      </Toast.Title>
      <Toast.Description className={styles.description}>
        {trade.type === "request_reward" ? `${trade.requestCustomer}: earned ${trade.total} shekels.` : <>{trade.type === "market_sale" ? "Sold" : "Bought"} {trade.quantity} {trade.itemKey === "beer" ? (trade.quantity === 1 ? "beer jar" : "beer jars") : trade.itemKey === "brewingVessels" || trade.itemKey === "emptyBeerJar" ? MARKET_ITEM_DEFINITIONS[trade.itemKey].label.toLowerCase() : trade.itemKey} for {trade.total} {trade.total === 1 ? "shekel" : "shekels"}.</>}
        <span>{trade.source === "npc" ? "NPC market" : "Player market"}</span>
      </Toast.Description>
      <Toast.Close className={styles.close} aria-label="Dismiss trade notification"><Cross2Icon /></Toast.Close>
    </Toast.Root>
  );
}

export default function TradeNotifications() {
  const playerId = useStore(farmStore, state =>
    state.farm.type === "ready" ? state.farm.snapshot.farm.playerId : null
  );
  const pending = useStore(notificationStore, state => state.pending);

  useEffect(() => {
    notificationStore.getState().setPlayer(playerId);
    if (playerId === null) return;

    const controller = new AbortController();
    let previousId: string | null | undefined;
    let fetching = false;
    const isVisible = () => document.visibilityState === "visible";
    const refresh = async () => {
      if (fetching || !isVisible()) return;
      fetching = true;
      try {
        const result = await collectNewTrades(
          before => fetchTradeHistory({ limit: 50, before }, controller.signal),
          previousId
        );
        if (controller.signal.aborted || !isVisible()) return;
        previousId = result.newestId;
        for (const trade of result.trades) notificationStore.getState().notifyTrade(playerId, trade);
      } catch (error) {
        if (!controller.signal.aborted) console.error("Failed to check trade notifications", error);
      } finally {
        fetching = false;
      }
    };
    void refresh();
    const interval = window.setInterval(() => { void refresh(); }, 5_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [playerId]);

  return createPortal(
    <Toast.Provider duration={5_000} swipeDirection="left">
      {pending.slice(0, 3).map(trade => (
        <TradeToast key={trade.id} trade={trade} />
      ))}
      <Toast.Viewport className={styles.viewport} label="Trade notifications ({hotkey})" />
    </Toast.Provider>,
    document.body
  );
}
