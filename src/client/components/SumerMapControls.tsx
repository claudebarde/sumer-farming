import { useState } from "react";
import { useStore } from "zustand";
import { ResidenceCommandSchema } from "../../schemas/residence";
import { requestResidence } from "../api/residence";
import { SUMER_CITIES } from "../../game-data/sumer";
import { sumerMapStore } from "../stores/sumerMapStore";
import styles from "../styles/GameCanvas.module.scss";

export default function SumerMapControls({ onBack }: { readonly onBack?: () => void }) {
  const selected = useStore(sumerMapStore, state => state.selectedCity);
  const residence = useStore(sumerMapStore, state => state.residence);
  const city = SUMER_CITIES.find(item => item.id === selected);
  const home = SUMER_CITIES.find(item => item.id === residence?.city);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const settle = async () => {
    const command = ResidenceCommandSchema.safeParse({ type: "settle", city: selected });
    if (!command.success) { setError("Choose a city for your farm."); return; }
    setBusy(true); setError("");
    try {
      const residence = await requestResidence(command.data);
      if (!residence) throw new Error("Your city was not saved. Please retry.");
      sumerMapStore.setState({ residence, selectedCity: residence.city });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Please retry."); }
    finally { setBusy(false); }
  };
  return <section className={styles["sumer-controls"]} aria-label="Map of Sumer">
    <header><h2>{residence ? "Sumer" : "Choose your city"}</h2>{residence && onBack && <button autoFocus onClick={onBack}>Back to your farm</button>}</header>
    <footer>
      <nav aria-label="Explore Sumerian cities">{SUMER_CITIES.map(item =>
        <button disabled={busy} key={item.id} aria-pressed={selected === item.id} onClick={() => sumerMapStore.getState().selectCity(item.id)}>{item.name}</button>
      )}</nav>
      <p role="status">{city ? `Exploring ${city.name}. ` : "Select a city on the map. "}{residence ? `Your estate: ${home?.name} · ${residence.name} (${residence.members}/10 players).` : "Choose where to establish your farm."}</p>
      {residence ? <>
        <small>Illustrative map, not to scale. Browsing does not move your farm.</small>
      </> : <form className={styles["city-choice"]} onSubmit={event => { event.preventDefault(); void settle(); }}>
        <small>You will automatically join a public neighbourhood in your city, with up to 10 players. If all neighbourhoods are full, a new one will welcome you and future neighbours.</small>
        {error && <p role="alert">{error}</p>}
        <button disabled={!city || busy} type="submit">{busy ? "Saving…" : `Start your farm${city ? ` in ${city.name}` : ""}`}</button>
      </form>}
    </footer>
  </section>;
}
