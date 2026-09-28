import { useEffect, useState } from "react";
import { useStore } from "zustand";
import { Dialog } from "radix-ui";
import { Cross2Icon } from "@radix-ui/react-icons";
import { NpcRequestsSchema } from "../../schemas/npcRequests";
import { developmentPlayerHeaders } from "../api/developmentPlayer";
import { farmStore } from "../stores/farmStore";
import { marketUiStore } from "../stores/marketUiStore";
import { merchantUiStore } from "../stores/merchantUiStore";
import { getMerchantVisit } from "../game/phaser/merchantVisit";
import NpcRequests from "./NpcRequests";
import styles from "../styles/GameCanvas.module.scss";

/** Keep the visitor schedule loaded even when its requests dialog is closed. */
export default function MerchantRequests() {
  const playerId = useStore(farmStore, state => state.farm.type === "ready" ? state.farm.snapshot.farm.playerId : null);
  const location = useStore(marketUiStore, state => state.location);
  const { board, clockOffset, isOpen } = useStore(merchantUiStore);
  const [clock, setClock] = useState(Date.now);
  useEffect(() => {
    merchantUiStore.getState().reset();
    if (!playerId) return;
    const controller = new AbortController();
    let fetching = false;
    const load = async () => {
      if (fetching) return;
      fetching = true;
      try {
        const response = await fetch("/api/market/requests", { headers: developmentPlayerHeaders(), signal: controller.signal });
        if (!response.ok) return;
        const result = NpcRequestsSchema.parse(await response.json());
        if (!controller.signal.aborted) merchantUiStore.getState().setBoard(result);
      } catch { /* Retry on focus or the next poll; never invent a local schedule. */ }
      finally { fetching = false; }
    };
    void load();
    const poll = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 60_000);
    const tick = window.setInterval(() => setClock(Date.now()), 1000);
    const onVisible = () => { if (document.visibilityState === "visible") void load(); };
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort(); window.clearInterval(poll); window.clearInterval(tick);
      window.removeEventListener("focus", load);
      document.removeEventListener("visibilitychange", onVisible);
      merchantUiStore.getState().reset();
    };
  }, [playerId]);
  const available = board !== null && getMerchantVisit(board, clock + clockOffset).phase === "stopped";
  useEffect(() => {
    if (!available || location !== "farm") merchantUiStore.getState().setOpen(false);
  }, [available, location]);
  return <Dialog.Root open={isOpen && available && location === "farm"} onOpenChange={merchantUiStore.getState().setOpen}>
    <Dialog.Portal>
      <Dialog.Overlay className={styles["market-dialog-overlay"]} />
      <Dialog.Content className={styles["market-dialog-content"]}>
        <header className={styles["market-dialog-header"]}>
          <Dialog.Title>Merchant chariot</Dialog.Title>
          <Dialog.Close asChild><button className={styles["market-dialog-close"]} aria-label="Close merchant requests"><Cross2Icon /></button></Dialog.Close>
        </header>
        <div className={styles["market-dialog-body"]}>
          <Dialog.Description>Fulfill the visiting merchant’s requests to earn shekels.</Dialog.Description>
          <NpcRequests key={playerId} onDelivered={() => {}} />
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
