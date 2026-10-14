import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Toast } from "radix-ui";
import { Cross2Icon } from "@radix-ui/react-icons";
import { useStore } from "zustand";
import { fetchTradeHistory } from "../api/tradeHistory";
import { collectNewTrades } from "../features/market/tradeNotifications";
import { farmStore } from "../stores/farmStore";
import { notificationStore, type GameNotification } from "../stores/notificationStore";
import { LEVEL_NAMES, LEVEL_UNLOCKS } from "../../game-data/progression";
import styles from "../styles/TradeNotifications.module.scss";
import { MARKET_ITEM_DEFINITIONS } from "../../game-data/marketItems";
import { buildingReadinessText } from "../../game-core/farm/buildingReadiness";
import { buildingReadinessCandidate } from "../features/buildingReadiness";
import { claimBuildingReadiness, OPEN_BUILD_DRAWER } from "../api/buildingReadiness";
import { marketUiStore } from "../stores/marketUiStore";

function TradeToast({ trade }: { readonly trade: GameNotification }) {
  const onFarm = useStore(marketUiStore, state => state.location === "farm");
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
      className={`${styles.toast} ${trade.type === "level_up" ? styles.celebration : ""}`}
      type={trade.type === "level_up" ? "foreground" : "background"}
      duration={trade.type === "level_up" ? 8_000 : 5_000}
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
        {trade.type === "building_ready" ? buildingReadinessText(trade.building).title : trade.type === "level_up" ? `Congratulations! Farm level ${trade.level}!` : trade.type === "building_upgrade" ? "Building upgrade started" : trade.type === "porter_hire" ? "Porter hired" : trade.type === "request_reward" ? "Request delivered" : trade.type === "market_sale" ? "Sale completed" : "Purchase completed"}
      </Toast.Title>
      <Toast.Description className={styles.description}>
        {trade.type === "building_ready" ? buildingReadinessText(trade.building).description : trade.type === "level_up" ? <>{LEVEL_NAMES[trade.level]}<span>Unlocked: {LEVEL_UNLOCKS[trade.level]}.</span></> : <>
          {trade.type === "building_upgrade" ? `Paid ${trade.total} shekels.` : trade.type === "porter_hire" ? `Automatic collection for 24 hours · ${trade.total} shekels.` : trade.type === "request_reward" ? `${trade.requestCustomer}: earned ${trade.total} shekels.` : <>{trade.type === "market_sale" ? "Sold" : "Bought"} {trade.quantity} {trade.itemKey === "beer" ? (trade.quantity === 1 ? "beer jar" : "beer jars") : trade.itemKey === "brewingVessels" || trade.itemKey === "emptyBeerJar" ? MARKET_ITEM_DEFINITIONS[trade.itemKey].label.toLowerCase() : trade.itemKey} for {trade.total} {trade.total === 1 ? "shekel" : "shekels"}.</>}
          <span>{trade.type === "porter_hire" || trade.type === "building_upgrade" ? "Estate service" : trade.source === "npc" ? "NPC market" : "Player market"}</span>
        </>}
      </Toast.Description>
      {trade.type === "building_ready" && onFarm && <Toast.Action altText="Open the Build tab in Manage estate" asChild>
        <button onClick={() => window.dispatchEvent(new Event(OPEN_BUILD_DRAWER))}>Open Build</button>
      </Toast.Action>}
      <Toast.Close className={styles.close} aria-label="Dismiss notification"><Cross2Icon /></Toast.Close>
    </Toast.Root>
  );
}

export default function TradeNotifications() {
  const playerId = useStore(farmStore, state =>
    state.farm.type === "ready" ? state.farm.snapshot.farm.playerId : null
  );
  const pending = useStore(notificationStore, state => state.pending);

  useEffect(() => {
    if (!playerId) return;
    let requesting = false;
    let recheck = false;
    const check = async () => {
      if (requesting) { recheck = true; return; }
      const state = farmStore.getState().farm;
      if (document.visibilityState !== "visible" || state.type !== "ready" || state.snapshot.farm.playerId !== playerId) return;
      const building = buildingReadinessCandidate(state.snapshot, notificationStore.getState().materialDropFarmId);
      if (!building) return;
      requesting = true;
      try {
        const claimed = await claimBuildingReadiness();
        if (claimed) notificationStore.getState().notifyBuilding(playerId, state.snapshot.farm.id, claimed, state.snapshot.farm.version);
      } catch (error) { console.error("Building readiness notification failed", error); }
      finally {
        requesting = false;
        if (recheck) { recheck = false; void check(); }
      }
    };
    // The player effect below establishes notification ownership before this microtask.
    void Promise.resolve().then(check);
    const unsubscribe = farmStore.subscribe(() => { void check(); });
    const unsubscribeDrop = notificationStore.subscribe((next, previous) => {
      if (previous.materialDropFarmId && !next.materialDropFarmId) void check();
    });
    const onVisible = () => { void check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { unsubscribe(); unsubscribeDrop(); document.removeEventListener("visibilitychange", onVisible); };
  }, [playerId]);

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
      <Toast.Viewport className={styles.viewport} label="Game notifications ({hotkey})" />
    </Toast.Provider>,
    document.body
  );
}
