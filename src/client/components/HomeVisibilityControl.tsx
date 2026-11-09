import { useState } from "react";
import { ToggleGroup } from "radix-ui";
import { FarmSnapshotSchema, type FarmSnapshot } from "../../schemas/farm";
import type { HomeVisibility } from "../../schemas/homeAppearance";
import { developmentPlayerHeaders } from "../api/developmentPlayer";
import styles from "../styles/HomeDrawer.module.scss";

export default function HomeVisibilityControl({ visibility, onSaved }: {
  readonly visibility: HomeVisibility; readonly onSaved: (snapshot: FarmSnapshot) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const change = async (value: string) => {
    if ((value !== "everyone" && value !== "private") || pending || value === visibility) return;
    setPending(true); setError(null);
    try {
      const response = await fetch("/api/home-visibility", {
        method: "POST", headers: { ...developmentPlayerHeaders(), "content-type": "application/json" }, body: JSON.stringify(value),
      });
      const data = await response.json();
      if (!response.ok) throw new Error((data as {error?: {message?: string}}).error?.message ?? "Could not change home visibility.");
      onSaved(FarmSnapshotSchema.parse(data));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not change home visibility."); }
    finally { setPending(false); }
  };
  return <section className={styles.decorations}>
    <h3>Who can visit your home?</h3>
    <ToggleGroup.Root type="single" value={visibility} disabled={pending} className={styles.styleChoices}
      aria-label="Home visibility" onValueChange={value => void change(value)}>
      <ToggleGroup.Item value="everyone" className={styles.styleChoice}>Everyone</ToggleGroup.Item>
      <ToggleGroup.Item value="private" className={styles.styleChoice}>Private</ToggleGroup.Item>
    </ToggleGroup.Root>
    {error && <p role="alert">{error}</p>}
  </section>;
}
