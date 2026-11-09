import { useEffect, useState } from "react";
import { useStore } from "zustand";
import { Dialog } from "radix-ui";
import { Cross2Icon } from "@radix-ui/react-icons";
import { requestPlayerHome, requestPlayerProfile } from "../api/playerHome";
import type { PlayerHome, PlayerProfile } from "../../schemas/playerHome";
import { farmStore } from "../stores/farmStore";
import HomeInterior from "./HomeInterior";
import FarmerPortrait from "./FarmerPortrait";
import BuildingActionIcon from "./BuildingActionIcon";
import styles from "../styles/GameCanvas.module.scss";
import board from "../styles/Leaderboard.module.scss";
import actions from "../styles/BuildingActionButton.module.scss";
import levelBadge from "../../assets/sprite_assets/pngs/v2/isometric-test/badges/level-10-badge.png";
import patronBadge from "../../assets/sprite_assets/pngs/v2/isometric-test/badges/ziggurat-patron.png";

export default function PlayerProfileDialog({ playerId, onClose }: {
  readonly playerId: string; readonly onClose: () => void;
}) {
  const farm = useStore(farmStore, state => state.farm);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [home, setHome] = useState<PlayerHome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setClock(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void requestPlayerProfile(playerId, controller.signal).then(setProfile).catch(cause => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Profile unavailable.");
    });
    return () => controller.abort();
  }, [playerId]);
  const isPrivateHome = profile?.unavailableReason === "This home is private.";
  const isVisiting = home !== null;
  // Recheck access while visiting, including after the owner changes privacy.
  useEffect(() => {
    if (!isVisiting) return;
    const controller = new AbortController();
    const check = () => void requestPlayerHome(playerId, controller.signal).then(setHome).catch(cause => {
      if (!controller.signal.aborted) {
        setHome(null); setError(cause instanceof Error ? cause.message : "This home is unavailable.");
      }
    });
    const timer = window.setInterval(check, 15_000);
    const visible = () => { if (!document.hidden) check(); };
    document.addEventListener("visibilitychange", visible);
    return () => { controller.abort(); window.clearInterval(timer); document.removeEventListener("visibilitychange", visible); };
  }, [isVisiting, playerId]);
  const visit = async () => {
    setPending(true); setError(null);
    try { setHome(await requestPlayerHome(playerId)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "This home is unavailable."); }
    finally { setPending(false); }
  };
  return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className={styles["market-dialog-overlay"]} />
      <Dialog.Content className={styles["market-dialog-content"]} aria-describedby={undefined}>
        <header className={styles["market-dialog-header"]}>
          <Dialog.Title>{profile?.name ?? "Farmer"}</Dialog.Title>
          <Dialog.Close asChild><button aria-label="Close profile" className={styles["market-dialog-close"]}><Cross2Icon /></button></Dialog.Close>
        </header>
        <div className={styles["market-dialog-body"]}>
          {!profile && !error && <p role="status">Loading farmer…</p>}
          {profile && <>
            <div className={board.identity}>
              <FarmerPortrait name={profile.name} />
              <div><p>Farm level {profile.level}</p><p>{profile.neighbourhood}</p>
                {profile.level >= 10 && <img className={board.tabletBadge} src={levelBadge} alt="Reached estate level 10" />}
                {profile.zigguratPatron && <img className={board.tabletBadge} src={patronBadge} alt="Ziggurat Patron" />}
              </div>
            </div>
            <button className={actions.button} disabled={!profile.canVisit || pending || farm.type !== "ready"} onClick={() => void visit()}>
              <BuildingActionIcon kind="farm" /><span>{isPrivateHome ? "This home is private" : pending ? "Opening home…" : "Visit home"}</span>
            </button>
            {!profile.canVisit && !isPrivateHome && <p>{profile.unavailableReason}</p>}
          </>}
          {error && <p role="alert">{error}</p>}
        </div>
        {home && farm.type === "ready" && <HomeInterior snapshot={farm.snapshot} clock={clock} onSaved={() => undefined}
          visit={{ playerId: home.profile.playerId, name: home.profile.name, appearance: home.appearance }} onClose={() => setHome(null)} />}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
