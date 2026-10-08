import { useState } from "react";
import { MALE_FARMER_NAMES, FEMALE_FARMER_NAMES } from "../../game-data/farmerNames";
import type { FarmerProfile } from "../../schemas/farmerProfile";
import { saveFarmerName } from "../api/farmerProfile";

export default function FarmerCustomization({ onSaved }: { readonly onSaved: (profile: FarmerProfile) => void }) {
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setPending(true); setError("");
    try {
      onSaved(await saveFarmerName(name));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Please retry."); }
    finally { setPending(false); }
  };
  return <section style={{ maxWidth: 560, margin: "32px auto", padding: 24 }} aria-label="Farmer customization">
    <h2>Meet your farmer</h2>
    <p>Choose your farmer’s name.</p>
    <form onSubmit={event => { event.preventDefault(); void save(); }}>
      <label htmlFor="farmer-name">Farmer’s name</label>{" "}
      <select id="farmer-name" required value={name} disabled={pending} onChange={event => setName(event.target.value)}>
        <option value="" disabled>Choose a name</option>
        <optgroup label="Male names">{MALE_FARMER_NAMES.map(name => <option key={name}>{name}</option>)}</optgroup>
        <optgroup label="Female names">{FEMALE_FARMER_NAMES.map(name => <option key={name}>{name}</option>)}</optgroup>
      </select>
      <p>The name does not change your farmer’s appearance or abilities.</p>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={!name || pending}>{pending ? "Saving…" : "Continue"}</button>
    </form>
  </section>;
}
