import { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import { IsometricTestScene } from "../game/phaser/scenes/IsometricTestScene";
import styles from "../styles/IsometricTest.module.scss";

export default function IsometricTest() {
  const parent = useRef<HTMLDivElement>(null);
  const scene = useRef<IsometricTestScene | null>(null);
  const [status, setStatus] = useState("Tap the ground to walk; tap a field to plant.");
  useEffect(() => {
    if (!parent.current) return;
    const current = new IsometricTestScene(setStatus);
    scene.current = current;
    const game = new Phaser.Game({ type: Phaser.AUTO, parent: parent.current,
      backgroundColor: "#f4e5c7", scene: [current],
      scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
      input: { windowEvents: false }, render: { antialias: true } });
    return () => { scene.current = null; game.destroy(true); };
  }, []);
  return <section className={styles.test} aria-label="Isometric sandbox">
    <div className={styles.toolbar}>
      <span>Visual sandbox · no saved changes</span>
      <button onClick={() => scene.current?.zoomBy(1.2)} aria-label="Zoom in">+</button>
      <button onClick={() => scene.current?.zoomBy(1 / 1.2)} aria-label="Zoom out">−</button>
      <button onClick={() => scene.current?.fit()}>Fit</button>
    </div>
    <div ref={parent} className={styles.canvas} />
    <p role="status" className={styles.status}>{status}</p>
  </section>;
}
