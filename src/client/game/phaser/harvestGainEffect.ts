import { ACTION_POINTS } from "../../../game-data/points";
import type Phaser from "phaser";
import type { FarmSnapshot } from "../../../schemas/farm";
import type { CropWork } from "../../../game-data/cropWork";
import { isometricHarvestPose, type HarvestGain } from "./isometricHarvesting";
import { isoPoint } from "./isometricProjection";

export const HARVEST_GAIN_DURATION = 1500;

/** The saved harvest timeline supplies the field; scoring is per completed action. */
export const sesameHarvestGains = (job: CropWork | null | undefined): readonly HarvestGain[] =>
  job?.cropKey === "sesame" && job.action === "harvest" && job.quantity > 0 && job.inbound[0]
    ? [{ cell: job.inbound[0], at: job.workEndsAt, quantity: ACTION_POINTS.harvestSesame }] : [];

/** Only newly observed completions; never replay an offline backlog. */
export const recentHarvestGains = (gains: readonly HarvestGain[], previous: number | null, now: number) =>
  previous === null || now < previous || now - previous > 500 ? []
    : gains.filter(gain => gain.at > previous && gain.at <= now && gain.quantity > 0);

export const harvestGainPresentation = (elapsed: number, reducedMotion: boolean) => {
  const progress = Math.max(0, Math.min(1, elapsed / HARVEST_GAIN_DURATION));
  return { offsetY: reducedMotion ? -48 : -12 - 116 * progress,
    alpha: Math.min(1, (1 - progress) / 0.4) };
};

/** Cosmetic only: no commands, resource mutations or work delays. */
export class HarvestGainEffect {
  private previous: number | null = null;
  private effects: { gain: HarvestGain; elapsed: number; displayed: boolean; startAt?: number; sprite?: Phaser.GameObjects.Container }[] = [];
  private readonly scene: Phaser.Scene;
  constructor(scene: Phaser.Scene) { this.scene = scene; }

  reset() {
    this.previous = null;
    this.effects.forEach(effect => effect.sprite?.destroy());
    this.effects = [];
  }

  enqueue(gains: readonly HarvestGain[]) {
    this.effects.push(...gains.filter(gain => gain.quantity > 0)
      .map(gain => ({ gain, elapsed: 0, displayed: false, startAt: gain.at })));
  }

  sample(snapshot: FarmSnapshot, now: number, visible: boolean) {
    if (!visible) { this.reset(); return; }
    const gains = recentHarvestGains([
      ...(isometricHarvestPose(snapshot, now)?.gains ?? []).map(gain => ({ ...gain, quantity: ACTION_POINTS.harvestBarley })),
      ...sesameHarvestGains(snapshot.farm.production.cropWork),
      ...(snapshot.farm.production.cropWorkQueue ?? []).flatMap(sesameHarvestGains)
    ], this.previous, now);
    this.previous = now;
    this.effects.push(...gains.map(gain => ({ gain, elapsed: 0, displayed: false })));
  }

  render(delta: number, reducedMotion: boolean) {
    this.effects = this.effects.filter(effect => {
      if (effect.startAt !== undefined && Date.now() < effect.startAt) return true;
      // Start at the first visible frame. Expensive redraws must not consume
      // the rise before the player can see it. Server time only triggers gains.
      if (effect.displayed) effect.elapsed += Math.max(0, Math.min(50, delta));
      const elapsed = effect.elapsed;
      if (elapsed >= HARVEST_GAIN_DURATION) { effect.sprite?.destroy(); return false; }
      // Recreate destroyed objects, retaining the remaining animation time.
      if (!effect.sprite?.scene) {
        const label = this.scene.add.text(0, 0, `+${effect.gain.quantity}`, {
          fontFamily: "Georgia, serif", fontSize: "24px", fontStyle: "bold",
          color: "#fff5da", stroke: "#503016", strokeThickness: 3
        }).setOrigin(0.5);
        effect.sprite = this.scene.add.container(0, 0, [label]).setDepth(10010);
      }
      // DisplayList.removeAll(true) detaches objects without destroying them
      // (true skips callbacks). A scene reference does not imply visibility.
      if (!this.scene.children.exists(effect.sprite)) this.scene.children.add(effect.sprite);
      const point = isoPoint(effect.gain.cell);
      const pose = harvestGainPresentation(elapsed, reducedMotion);
      effect.sprite.setPosition(point.x, point.y + pose.offsetY).setAlpha(pose.alpha);
      effect.displayed = true;
      return true;
    });
  }
}
