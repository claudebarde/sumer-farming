import { useEffect, useState } from "react";
import { DEVELOPMENT_PLAYERS_CHANGED, fetchDevelopmentPlayers } from "../api/developmentPlayer";

export default function DevelopmentPlayerSelector() {
  const [players, setPlayers] = useState<Awaited<ReturnType<typeof fetchDevelopmentPlayers>>>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    let controller: AbortController | undefined;
    const refresh = () => {
      controller?.abort();
      const current = new AbortController(); controller = current;
      void fetchDevelopmentPlayers(current.signal).then(players => {
        if (!current.signal.aborted) { setPlayers(players); setError(false); }
      }).catch(() => { if (!current.signal.aborted) setError(true); });
    };
    refresh();
    window.addEventListener(DEVELOPMENT_PLAYERS_CHANGED, refresh);
    window.addEventListener("focus", refresh);
    return () => { controller?.abort(); window.removeEventListener(DEVELOPMENT_PLAYERS_CHANGED, refresh); window.removeEventListener("focus", refresh); };
  }, []);
  if (!import.meta.env.DEV) return null;
  const current = new URLSearchParams(window.location.search).get("devPlayer") ?? "primary";
  const named = players.some(player => player.key === current);

  return (
    <label>
      Test player{" "}
      <select
        value={named ? current : ""}
        disabled={players.length === 0}
        onChange={event => {
          const url = new URL(window.location.href);
          url.searchParams.set("devPlayer", event.target.value);
          window.location.assign(url);
        }}
      >
        {!named && <option value="" disabled>{error ? "Could not load players" : "Select a named farmer"}</option>}
        {players.map(player => (
          <option key={player.key} value={player.key}>{player.name}</option>
        ))}
      </select>
    </label>
  );
}
