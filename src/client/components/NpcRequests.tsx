import { useEffect, useState } from "react";
import { useStore } from "zustand";
import { NpcRequestsSchema, type NpcRequests as RequestBoard } from "../../schemas/npcRequests";
import { canDeliverRequest } from "../../game-core/market/npcRequests";
import { developmentPlayerHeaders } from "../api/developmentPlayer";
import { executeGameCommand } from "../api/gameActions";
import { farmStore } from "../stores/farmStore";
import styles from "../styles/GameCanvas.module.scss";

const timeLeft = (milliseconds: number) => {
  const minutes = Math.max(0, Math.ceil(milliseconds / 60_000));
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};

export default function NpcRequests({ onDelivered }: { readonly onDelivered: () => void }) {
  const farm = useStore(farmStore, state => state.farm);
  const version = farm.type === "ready" ? farm.snapshot.farm.version : 0;
  const playerId = farm.type === "ready" ? farm.snapshot.farm.playerId : null;
  const [response, setResponse] = useState<{ readonly board: RequestBoard; readonly offset: number; readonly playerId: string | null; readonly version: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [clock, setClock] = useState(Date.now);

  useEffect(() => {
    const controller = new AbortController();
    let fetching = false;
    const load = async () => {
      if (fetching) return;
      fetching = true;
      try {
        const result = await fetch("/api/market/requests", { headers: developmentPlayerHeaders(), signal: controller.signal });
        if (!result.ok) throw new Error("Requests could not be loaded. Please retry.");
        const board = NpcRequestsSchema.parse(await result.json());
        if (!controller.signal.aborted) {
          setResponse({ board, offset: Date.parse(board.serverNow) - Date.now(), playerId, version });
        }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Requests could not be loaded.");
      } finally { fetching = false; }
    };
    void load();
    const poll = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 5000);
    const tick = window.setInterval(() => setClock(Date.now()), 1000);
    window.addEventListener("focus", load);
    return () => { controller.abort(); window.clearInterval(poll); window.clearInterval(tick); window.removeEventListener("focus", load); };
  }, [playerId, version, refresh]);

  const board = response?.playerId === playerId ? response?.board : undefined;
  const now = clock + (response?.offset ?? 0);
  const open = board !== undefined && board.open && now < Date.parse(board.closesAt);
  const deliver = async (slot: number) => {
    if (!board || farm.type !== "ready" || pending) return;
    setPending(true);
    setError(null);
    try {
      const snapshot = await executeGameCommand({ type: "deliver_npc_request", cycle: board.cycle, slot,
        idempotencyKey: crypto.randomUUID(), expectedFarmVersion: farm.snapshot.farm.version });
      if (farmStore.getState().farm.type === "ready") farmStore.getState().setReady(snapshot);
      onDelivered();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Delivery failed.");
    } finally { setPending(false); setRefresh(value => value + 1); }
  };

  return <section aria-label="NPC requests">
    <p>Three requests, available for 24 hours, followed by a two-day break. No penalty for missing a visit.</p>
    {error && <p role="alert">{error}</p>}
    <button disabled={pending} onClick={() => { setError(null); setRefresh(value => value + 1); }}>Refresh requests</button>
    {!board ? <p role="status">Loading requests…</p> : !open ? (
      <p>New requests in {timeLeft(Date.parse(board.nextOpensAt) - now)}.</p>
    ) : <>
      <p>Requests close in {timeLeft(Date.parse(board.closesAt) - now)}.</p>
      <p>Deliveries use barley stored in the farm or granaries and beer in estate inventory.</p>
      {board.requests.map(request => {
        const enough = canDeliverRequest(request, board.stock);
        return <section key={request.slot} className={styles["market-item"]}>
          <h3>{request.customer}</h3>
          <p>{request.description}</p>
          {request.barley > 0 && <p>Barley: {board.stock.barley} / {request.barley}</p>}
          {request.beer > 0 && <p>Beer jars: {board.stock.beer} / {request.beer}</p>}
          <p>Reward: {request.reward} shekels</p>
          {request.completed ? <p>Delivered ✓</p> : <>
            {enough && request.barley > 0 && board.stock.barley - request.barley < 1 && <p role="note">This delivery would leave no barley for the farmer’s next ration.</p>}
            {enough ? <button disabled={pending || response?.version !== version} onClick={() => { void deliver(request.slot); }}>
              {pending ? "Delivering…" : `Deliver for ${request.reward} shekels`}
            </button> : <p>Store the missing goods to deliver this request.</p>}
          </>}
        </section>;
      })}
    </>}
  </section>;
}
