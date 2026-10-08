import { useStore } from "zustand";
import { useEffect, useState } from "react";
import { Dialog, Tabs } from "radix-ui";
import { Cross2Icon } from "@radix-ui/react-icons";
import { marketUiStore } from "../stores/marketUiStore";
import styles from "../styles/GameCanvas.module.scss";
import boardStyles from "../styles/Leaderboard.module.scss";
import { LEADERBOARD_METRICS, type LeaderboardQuery, type LeaderboardResponse } from "../../schemas/leaderboard";
import { requestLeaderboard } from "../api/leaderboard";
import LeaderboardTable from "./LeaderboardTable";

type LoadState = { type: "loading" } | { type: "error" } | { type: "ready"; board: LeaderboardResponse };

function Results({ query }: { readonly query: LeaderboardQuery }) {
  const [state, setState] = useState<LoadState>({ type: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]);
    void requestLeaderboard(query, signal).then(board => {
      if (!controller.signal.aborted) setState({ type: "ready", board });
    }).catch(() => {
      if (!controller.signal.aborted) setState({ type: "error" });
    });
    return () => controller.abort();
  }, [query]);
  if (state.type === "loading") return <p role="status">Loading leaderboard…</p>;
  if (state.type === "error") return <p role="alert">The leaderboard could not be loaded. Use Refresh to try again.</p>;
  return <LeaderboardTable board={state.board} />;
}

export function LeaderboardContent() {
  const [query, setQuery] = useState<LeaderboardQuery>({ scope: "local", metric: "level" });
  const [refresh, setRefresh] = useState(0);
  return <Tabs.Root value={query.scope} onValueChange={scope => {
    if (scope === "local" || scope === "global") setQuery(current => ({ ...current, scope }));
  }}>
    <Tabs.List className={styles["manage-tabs-list"]} aria-label="Leaderboard scope">
      <Tabs.Trigger className={styles["manage-tabs-trigger"]} value="local">Your neighbourhood</Tabs.Trigger>
      <Tabs.Trigger className={styles["manage-tabs-trigger"]} value="global">All Sumer</Tabs.Trigger>
    </Tabs.List>
    {(["local", "global"] as const).map(scope => <Tabs.Content key={scope} value={scope} className={styles["market-tab-content"]}>
    <div className={boardStyles.controls}>
      <label>Rank by<select value={query.metric} onChange={event => setQuery({ ...query, metric: event.target.value as LeaderboardQuery["metric"] })}>
        {Object.entries(LEADERBOARD_METRICS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
      </select></label>
      <button onClick={() => setRefresh(value => value + 1)}>Refresh</button>
    </div>
    <p className={boardStyles.note}>{LEADERBOARD_METRICS[query.metric].description}</p>
    <Results key={`${query.scope}:${query.metric}:${refresh}`} query={query} />
    <p className={boardStyles.note}>Latest saved progress. Refresh to update. Equal scores share a rank. No ranking rewards yet.</p>
    </Tabs.Content>)}
  </Tabs.Root>;
}

export default function LeaderboardDialog() {
  const open = useStore(marketUiStore, state => state.location === "market" && state.leaderboardOpen);
  return <Dialog.Root open={open} onOpenChange={marketUiStore.getState().setLeaderboardOpen}>
    <Dialog.Portal>
      <Dialog.Overlay className={styles["market-dialog-overlay"]} />
      <Dialog.Content className={styles["market-dialog-content"]} aria-describedby={undefined}>
        <header className={styles["market-dialog-header"]}>
          <Dialog.Title>Leaderboard</Dialog.Title>
          <Dialog.Close asChild><button className={styles["market-dialog-close"]} aria-label="Close leaderboard"><Cross2Icon /></button></Dialog.Close>
        </header>
        <div className={styles["market-dialog-body"]}>{open && <LeaderboardContent />}</div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
