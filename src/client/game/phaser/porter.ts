import type Phaser from "phaser";
import { spriteName } from "../../../assets/farmSprites";
import { PORTER_STEP_MS } from "../../../game-data/porter";
import { farmStore } from "../../stores/farmStore";
import { fetchDevelopmentFarm } from "../../api/developmentPlayer";
import { TILE_SIZE } from "./config";
import type { TilePosition } from "./types";
import { porterApproach, porterPathLength, porterRoadOffset, positionAlongPorterPath } from "./porterPresentation";
import type { WorkerPoint, YieldingWorker } from "./workerAvoidance";

/** Independent, timestamp-driven actor. No farmer commands or movement locks. */
export const installPorter = (scene: Phaser.Scene, getOrigin: () => TilePosition, getMarketRoad: () => TilePosition, getRoadOffset: (tile: { column: number; row: number }) => number, depth: number): { dispose: () => void; worker: YieldingWorker } => {
  const sprite = scene.add.sprite(0, 0, spriteName("porterIdle")).setOrigin(0).setDisplaySize(TILE_SIZE, TILE_SIZE).setDepth(depth);
  let alive = true;
  let pending = false;
  let nextRefresh = 0;
  let waitingAtMarket = true;
  let approachJob: number | null = null;
  let approachStartedAt = 0;
  let initialized = false;
  let moving = false;
  let parked: WorkerPoint | null = null;
  let approachFrom: { posX: number; posY: number } | null = null;
  let yieldTween: Phaser.Tweens.Tween | null = null;
  let previousJob: number | null = null;
  const controller = new AbortController();
  const update = () => {
    const state = farmStore.getState().farm;
    if (state.type !== "ready") { sprite.setVisible(false); return; }
    const porter = state.snapshot.farm.production.porter;
    const now = Date.now();
    if (!porter || (!porter.job && porter.expiresAt <= now)) { sprite.setVisible(false); return; }
    const job = porter.job;
    const origin = getOrigin();
    if (job && job.startedAt !== previousJob && parked) {
      // Rejoin the job from the yielded road position, not the old loading point.
      yieldTween?.stop(); yieldTween = null;
      approachJob = job.startedAt;
      approachStartedAt = now;
      waitingAtMarket = false;
      approachFrom = { posX: parked.x, posY: parked.y + TILE_SIZE / 2 };
      parked = null;
    }
    previousJob = job?.startedAt ?? null;
    if (!initialized) {
      // Never relocate a delivery restored from the server.
      waitingAtMarket = !job;
      initialized = true;
    }
    if (job && waitingAtMarket) { approachJob = job.startedAt; approachStartedAt = now; waitingAtMarket = false; }
    const market = approachFrom ?? getMarketRoad();
    const marketLocal = { column: (market.posX - origin.posX) / TILE_SIZE, row: (market.posY - origin.posY) / TILE_SIZE };
    const approach = job && approachJob === job.startedAt
      ? porterApproach(marketLocal, job.path.slice(0, job.pickupIndex + 1)) : null;
    const approachDuration = approach ? porterPathLength(approach) * PORTER_STEP_MS : 0;
    // Keep the market approach at walking pace, then resume the saved delivery leg.
    const visualNow = job && approach ? job.pickupAt + now - approachStartedAt - approachDuration : now;
    const progress = job ? Math.max(0, (visualNow - job.startedAt) / PORTER_STEP_MS) : 0;
    const index = job ? Math.min(job.path.length - 1, Math.floor(progress)) : 0;
    const from = job?.path[index] ?? porter.position;
    const to = job?.path[Math.min(index + 1, job.path.length - 1)] ?? from;
    const fraction = progress - Math.floor(progress);
    sprite.setVisible(true).setTexture(spriteName(job && visualNow >= job.pickupAt ? "porterBusy" : "porterIdle"));
    const position = !job && waitingAtMarket ? marketLocal
      : approach && now < approachStartedAt + approachDuration
        ? positionAlongPorterPath(approach, (now - approachStartedAt) / Math.max(1, approachDuration))
        : { column: from.column + (to.column - from.column) * fraction, row: from.row + (to.row - from.row) * fraction };
    const roadOffset = porterRoadOffset({ column: origin.column + position.column, row: origin.row + position.row }, getRoadOffset);
    moving = !!job;
    if (!yieldTween) {
      if (!job && parked) sprite.setPosition(parked.x, parked.y);
      else sprite.setPosition(origin.posX + position.column * TILE_SIZE, origin.posY + position.row * TILE_SIZE + roadOffset);
    }
    if (to.column !== from.column) sprite.setFlipX(to.column < from.column);
    if (!pending && now >= nextRefresh && (!job || visualNow >= job.completesAt)) {
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
