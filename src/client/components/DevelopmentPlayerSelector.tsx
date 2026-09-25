import { DEVELOPMENT_PLAYERS } from "../../game-data/developmentPlayers";

export default function DevelopmentPlayerSelector() {
  if (!import.meta.env.DEV) return null;

  return (
    <label>
      Test player{" "}
      <select
        defaultValue={new URLSearchParams(window.location.search).get("devPlayer") ?? "primary"}
        onChange={event => {
          const url = new URL(window.location.href);
          url.searchParams.set("devPlayer", event.target.value);
          window.location.assign(url);
        }}
      >
        {DEVELOPMENT_PLAYERS.map(player => (
          <option key={player.key} value={player.key}>{player.displayName}</option>
        ))}
      </select>
    </label>
  );
}
