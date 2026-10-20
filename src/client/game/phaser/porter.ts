import type Phaser from "phaser";
import { spriteName } from "../../../assets/farmSprites";
import { PORTER_STEP_MS } from "../../../game-data/porter";
import { farmStore } from "../../stores/farmStore";
import { fetchDevelopmentFarm } from "../../api/developmentPlayer";
import { TILE_SIZE } from "./config";
import type { TilePosition } from "./types";
import { porterRoadOffset, positionAlongPorterPath } from "./porterPresentation";
import type { WorkerPoint, YieldingWorker } from "./workerAvoidance";

/** Independent, timestamp-driven actor. No farmer commands or movement locks. */
export const installPorter = (scene: Phaser.Scene, getOrigin: () => TilePosition, getRoadOffset: (tile: { column: number; row: number }) => number, depth: number): { dispose: () => void; worker: YieldingWorker } => {
  const sprite = scene.add.sprite(0, 0, spriteName("porterIdle")).setOrigin(0).setDisplaySize(TILE_SIZE, TILE_SIZE).setDepth(depth);
  let alive = true;
  let pending = false;
  let nextRefresh = 0;
  let moving = false;
  let parked: WorkerPoint | null = null;
  let yieldTween: Phaser.Tweens.Tween | null = null;
  let previousJob: number | null = null;
  const controller = new AbortController();
  const update = () => {
    const state = farmStore.getState().farm;
    if (state.type !== "ready") { sprite.setVisible(false); return; }
    const porter = state.snapshot.farm.production.porter;
    const now = Date.now();
    if (!porter || (!porter.job && !porter.returnTrip && porter.expiresAt <= now)) { sprite.setVisible(false); return; }
    const job = porter.job;
    const trip = job ?? porter.returnTrip;
    const origin = getOrigin();
    if (trip && trip.startedAt !== previousJob && parked) {
      // Reconcile to the saved journey; never add an independent approach clock.
      yieldTween?.stop(); yieldTween = null;
      parked = null;
    }
    previousJob = trip?.startedAt ?? null;
    const progress = trip ? Math.max(0, (now - trip.startedAt) / PORTER_STEP_MS) : 0;
    const index = trip ? Math.min(trip.path.length - 1, Math.floor(progress)) : 0;
    const from = trip?.path[index] ?? porter.position;
    const to = trip?.path[Math.min(index + 1, trip.path.length - 1)] ?? from;
    sprite.setVisible(true).setTexture(spriteName(job && now >= job.pickupAt ? "porterBusy" : "porterIdle"));
    const position = trip ? positionAlongPorterPath(trip.path, progress / Math.max(1, trip.path.length - 1)) : porter.position;
    const roadOffset = porterRoadOffset({ column: origin.column + position.column, row: origin.row + position.row }, getRoadOffset);
    moving = !!trip;
    if (!yieldTween) {
      if (!trip && parked) sprite.setPosition(parked.x, parked.y);
      else sprite.setPosition(origin.posX + position.column * TILE_SIZE, origin.posY + position.row * TILE_SIZE + roadOffset);
    }
    if (to.column !== from.column) sprite.setFlipX(to.column < from.column);
    if (!pending && now >= nextRefresh) {
      pending = true; nextRefresh = now + 2000;
      void fetchDevelopmentFarm(controller.signal).then(snapshot => {
        if (!alive) return;
        const current = farmStore.getState().farm;
        if (current.type === "ready" && current.snapshot.farm.id === snapshot.farm.id && snapshot.farm.version > current.snapshot.farm.version) farmStore.getState().setReady(snapshot);
      }).catch(() => { /* Retry without losing the persisted delivery. */ }).finally(() => { pending = false; });
    }
  };
  scene.events.on("update", update);
  update();
  return {
    worker: {
      read: () => ({ position: { x: sprite.x, y: sprite.y }, moving, yielding: yieldTween !== null, visible: sprite.visible }),
      yieldTo: point => {
        if (moving || yieldTween) return false;
        parked = point;
        yieldTween = scene.tweens.add({ targets: sprite, x: point.x, y: point.y,
          duration: Math.hypot(point.x - sprite.x, point.y - sprite.y) / TILE_SIZE * PORTER_STEP_MS, ease: "Linear",
          onComplete: () => { yieldTween = null; } });
        return true;
      }
    },
    dispose: () => { alive = false; controller.abort(); yieldTween?.stop(); scene.events.off("update", update); sprite.destroy(); }
  };
};
