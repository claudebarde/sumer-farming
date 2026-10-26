import type { CropWork } from "../../game-data/cropWork";
import { palmPlantingPose } from "../game/phaser/palmPlanting";
import meter from "../styles/HappinessMeter.module.scss";
import styles from "../styles/IsometricTest.module.scss";
import palm from "../../assets/sprite_assets/pngs/v2/isometric-test/date-palms/date-palm-isometric-empty.webp";

export default function PalmPlantingProgress({ job, now }: { job: CropWork; now: number }) {
  const pose = palmPlantingPose(job, job.outbound.at(-1)!, now);
  const tending = job.action === "tend";
  const label = tending ? "Tending date palm" : "Planting date palm";
  return <div className={styles.sowingProgress}>
    <img className={styles.barleyWorkIcon} src={palm} alt="" width={48} height={48} />
    <section><p role="status">{pose.traveling ? `Walking to ${tending ? "tend" : "plant"} date palm…` : `${label}…`}</p>
      <p>{pose.remainingSeconds}s remaining</p></section>
    <div className={meter.meter} data-mood="content" role="progressbar" aria-label={label}
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={pose.percentage}>
      <svg viewBox="0 0 100 100" aria-hidden="true"><circle className={meter.track} cx="50" cy="50" r="43" />
        <circle className={meter.fill} cx="50" cy="50" r="43" pathLength={100} strokeDasharray="100 100"
          strokeDashoffset={100 - pose.percentage} transform="rotate(-90 50 50)" /></svg>
      <span className={meter.value} aria-hidden="true">{pose.percentage}%</span>
    </div>
  </div>;
}
