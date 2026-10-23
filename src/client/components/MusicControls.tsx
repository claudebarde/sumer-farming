import { useStore } from "zustand";
import { PlayIcon, StopIcon, SpeakerQuietIcon, SpeakerLoudIcon } from "@radix-ui/react-icons";
import { musicSettingsStore } from "../stores/musicSettingsStore";
import styles from "../styles/MusicControls.module.scss";

export default function MusicControls() {
  const { enabled, volume, changeVolume, toggle } = useStore(musicSettingsStore);
  return <section className={styles.section} aria-labelledby="music-control-title">
    <h2 id="music-control-title">Music Control</h2>
    <div className={styles.buttons}>
      <button onClick={() => changeVolume(-1)} disabled={volume <= 0} aria-label="Lower music volume" title="Lower music volume">
        <SpeakerQuietIcon width={24} height={24} aria-hidden="true" />
      </button>
      <button onClick={toggle} aria-label={enabled ? "Stop music" : "Play music"} title={enabled ? "Stop music" : "Play music"}>
        {enabled ? <StopIcon width={24} height={24} aria-hidden="true" /> : <PlayIcon width={24} height={24} aria-hidden="true" />}
      </button>
      <button onClick={() => changeVolume(1)} disabled={volume >= 1} aria-label="Increase music volume" title="Increase music volume">
        <SpeakerLoudIcon width={24} height={24} aria-hidden="true" />
      </button>
    </div>
    <p role="status">Volume: {Math.round(volume * 100)}%{!enabled ? " · Stopped" : ""}</p>
  </section>;
}
