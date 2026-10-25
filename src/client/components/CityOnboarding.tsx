import { useEffect, useRef, useState, type ReactNode } from "react";
import Phaser from "phaser";
import { useStore } from "zustand";
import { fetchDevelopmentFarm } from "../api/developmentPlayer";
import { requestResidence } from "../api/residence";
import { sumerMapStore } from "../stores/sumerMapStore";
import { SumerScene } from "../game/phaser/scenes/SumerScene";
import SumerMapControls from "./SumerMapControls";
import FarmerCustomization from "./FarmerCustomization";
import type { FarmerProfile } from "../../schemas/farmerProfile";
import styles from "../styles/GameCanvas.module.scss";
import GameLoadingScreen from "./GameLoadingScreen";
import loadingStyles from "../styles/IsometricTest.module.scss";

function OnboardingMap() {
  const parent = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!parent.current) return;
    const game = new Phaser.Game({ type: Phaser.AUTO, parent: parent.current,
      scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" }, scene: [SumerScene] });
    return () => game.destroy(true);
  }, []);
  return <div className={styles["city-onboarding"]}>
    <div ref={parent} className={styles["onboarding-map"]} />
    <SumerMapControls />
  </div>;
}

export default function CityOnboarding({ children }: { readonly children: ReactNode }) {
  const residence = useStore(sumerMapStore, state => state.residence);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [profile, setProfile] = useState<FarmerProfile | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const snapshot = await fetchDevelopmentFarm(controller.signal);
        const home = await requestResidence(undefined, controller.signal);
        if (controller.signal.aborted) return;
        setProfile(snapshot.farm.farmerProfile ?? null);
        sumerMapStore.setState({ residence: home, selectedCity: home?.city ?? null });
        setState("ready");
      } catch { if (!controller.signal.aborted) setState("error"); }
    })();
    return () => controller.abort();
  }, [attempt]);
  if (state === "error") return <section role="alert">Your city could not be loaded. <button onClick={() => { setState("loading"); setAttempt(value => value + 1); }}>Retry</button></section>;
  if (state === "loading") return <section className={loadingStyles.test} aria-busy="true">
    <GameLoadingScreen state="loading" retry={() => window.location.reload()} />
  </section>;
  if (!profile) return <FarmerCustomization onSaved={setProfile} />;
  return residence ? children : <OnboardingMap />;
}
