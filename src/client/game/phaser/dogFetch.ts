import Phaser from "phaser";
import { spriteName } from "../../../assets/farmSprites";
import { evaluateFetchThrow, fetchPosition, findFetchRoutes, findDogWalk, planDogFollow, FETCH_FLIGHT_MS, type FetchPoint, type FetchRun } from "../../../game-core/fetch";
import { isProgressionSignpost } from "../../../game-data/progression";
import { farmStore } from "../../stores/farmStore";
import { buildingPlacementStore } from "../../stores/buildingPlacementStore";
import { INITIAL_FARM_CONFIG } from "../../../game-data/initialFarm";
import { fetchStore } from "../../stores/fetchStore";
import { gridStore } from "../../stores/gridStore";
import { marketUiStore } from "../../stores/marketUiStore";
import { interactionStore } from "../../stores/interactionStore";
import { TILE_SIZE } from "./config";
import { advanceDogGlance, type DogGlance } from "./dogGlance";

export const installDogFetch = (
  scene: Phaser.Scene,
  farmerPosition: () => FetchPoint,
  isBuildingTile: (column: number, row: number) => boolean,
  farmOrigin: () => { readonly column: number; readonly row: number },
  canPlay: () => boolean,
  notify: (message: string) => void
): void => {
  const dog = scene.add.image(0, 0, spriteName("dogSitting"))
    .setDisplaySize(48, 48).setDepth(20).setInteractive({ useHandCursor: true });
  const graphics = scene.add.graphics().setDepth(101);
  // Capture the round's pointer events before they reach farm tiles or tools.
  const input = scene.add.zone(0, 0, scene.scale.width, scene.scale.height)
    .setOrigin(0).setDepth(100).setInteractive().setVisible(false);
  let run: FetchRun | null = null;
  let startedAt = 0;
  let target: FetchPoint = { x: 0, y: 0 };
  let thrownAt: number | null = null;
  let landing: FetchPoint | null = null;
  let throwOrigin: FetchPoint = { x: 0, y: 0 };
  let landed = false;
  let outcome: ReturnType<typeof evaluateFetchThrow> | null = null;
  let placed = false;
  let nextFollowCheck = 0;
  const glanceDelay = () => 5_000 + Math.random() * 7_000;
  let glance: DogGlance = { type: "waiting", nextAt: scene.time.now + glanceDelay() };
  const resetGlance = () => {
    if (glance.type === "looking") dog.setFlipX(glance.originalFlip);
    glance = { type: "waiting", nextAt: scene.time.now + glanceDelay() };
  };
  let walk: { readonly points: readonly FetchPoint[]; readonly done: () => void; readonly kind: "follow" | "other"; index: number } | null = null;
  const sit = () => dog.setTexture(spriteName("dogSitting")).setDisplaySize(48, 48);
  const walkTo = (points: readonly FetchPoint[], done: () => void, kind: "follow" | "other" = "other") => {
    if (points.length === 0) { done(); return; }
    resetGlance();
    walk = { points, done, kind, index: 0 };
    dog.setTexture(spriteName("dogStanding")).setDisplaySize(48, 48);
  };

  const clear = () => {
    resetGlance();
    walk = null;
    run = null; thrownAt = null; landing = null; landed = false; outcome = null;
    input.setVisible(false);
    graphics.clear();
    dog.setTexture(spriteName("dogSitting")).setDisplaySize(48, 48);
  };
  const isClear = (column: number, row: number) => {
    const origin = farmOrigin();
    const grid = gridStore.getState().grid;
    const farm = farmStore.getState().farm;
    const tile = grid[row]?.[column];
    if (column < 0 || row < 0 || isBuildingTile(column, row)) return false;
    if (isProgressionSignpost({ column: column - origin.column, row: row - origin.row })) return false;
    if (farm.type === "ready" && farm.snapshot.improvements.some(i => i.column + origin.column === column && i.row + origin.row === row)) return false;
    return (column + 1) * TILE_SIZE <= scene.scale.width && (row + 1) * TILE_SIZE <= scene.scale.height &&
      (tile?.type === "ground" || tile?.type === "groundVariant" || tile?.type === "groundPathHorizontal");
  };
  const routes = () => findFetchRoutes(farmOrigin(), isClear, TILE_SIZE);
  const walkBounds = () => ({ column: 0, row: 0,
    columns: Math.floor(scene.scale.width / TILE_SIZE), rows: Math.floor(scene.scale.height / TILE_SIZE) });
  const place = () => {
    // A snapshot refresh must never move a resting dog to follow the farmer.
    if (placed && (walk || isClear(Math.floor(dog.x / TILE_SIZE), Math.floor(dog.y / TILE_SIZE)))) return;
    const farmer = farmerPosition();
    const candidates = routes();
    const road = candidates.filter(r => Math.floor(r.start.y / TILE_SIZE) === INITIAL_FARM_CONFIG.roadRow);
    const route = (road.length ? road : candidates).sort((a, b) =>
      Math.abs(Math.hypot(a.start.x - farmer.x, a.start.y - farmer.y) - TILE_SIZE * 1.5) -
      Math.abs(Math.hypot(b.start.x - farmer.x, b.start.y - farmer.y) - TILE_SIZE * 1.5))[0];
    const origin = farmOrigin();
    const fallback = Array.from({ length: 8 }, (_, i) => origin.column + i)
      .find(column => isClear(column, INITIAL_FARM_CONFIG.roadRow));
    const position = route?.start ?? (fallback === undefined ? null : {
      x: (fallback + 0.5) * TILE_SIZE, y: (INITIAL_FARM_CONFIG.roadRow + 0.5) * TILE_SIZE
    });
    if (!placed) {
      dog.setVisible(position !== null);
      if (position) { dog.setPosition(position.x, position.y); placed = true; }
    } else if (position) {
      const path = findDogWalk(dog, position, walkBounds(), isClear, TILE_SIZE);
      if (path) walkTo(path, sit);
    }
  };
  const finish = (message: string) => {
    input.setVisible(true);
    dog.setTexture(spriteName("dogSitting")).setDisplaySize(48, 48);
    fetchStore.getState().set("result", message);
    notify(message);
  };
  const start = () => {
    clear();
    if (!canPlay()) {
      fetchStore.getState().set("idle");
      notify("Let the farmer finish the current activity before playing fetch.");
      return;
    }
    const available = routes().flatMap(route => {
      const path = findDogWalk(dog, route.start, walkBounds(), isClear, TILE_SIZE);
      return path === null ? [] : [{ route, path }];
    });
    const shortest = Math.min(...available.map(candidate => candidate.path.length));
    const choices = available.filter(candidate => candidate.path.length === shortest);
    const candidate = choices[Math.floor(Math.random() * choices.length)];
    if (!candidate) {
      finish("The dog needs a clear stretch of ground to run. Try again after clearing some space.");
      return;
    }
    const choice = candidate.route;
    const fraction = 0.72 + Math.random() * 0.25;
    const nextRun = { ...choice, end: {
      x: choice.start.x + (choice.end.x - choice.start.x) * fraction,
      y: choice.start.y + (choice.end.y - choice.start.y) * fraction
    }, duration: 6_000 + Math.random() * 2_000 };
    input.setVisible(true);
    fetchStore.getState().set("starting", "The dog is walking to its starting point…");
    walkTo(candidate.path, () => {
      run = nextRun;
      dog.setVisible(true).setTexture(spriteName("dogStanding")).setDisplaySize(48, 48).setFlipX(run.end.x < run.start.x);
      target = fetchPosition(run, run.duration * 0.5);
      startedAt = scene.time.now;
      fetchStore.getState().set("running", "Throw ahead of the dog. Its stopping point is a secret!");
    });
  };
  const aim = (x: number, y: number) => {
    target = { x: Math.max(16, Math.min(scene.scale.width - 16, x)), y: Math.max(16, Math.min(scene.scale.height - 16, y)) };
  };
  const throwStick = () => {
    if (fetchStore.getState().phase !== "running" || !run) return;
    thrownAt = scene.time.now;
    landing = { ...target };
    throwOrigin = farmerPosition();
    fetchStore.getState().set("flying", "The stick is in the air…");
  };
  dog.on(Phaser.Input.Events.POINTER_UP, (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
    // Let the existing scene-level placement handler receive this click.
    if (buildingPlacementStore.getState().placement.type !== "idle") return;
    event.stopPropagation();
    if (marketUiStore.getState().location !== "farm") return;
    if (!canPlay()) { notify("Let the farmer finish the current activity before playing fetch."); return; }
    walk = null;
    sit();
    interactionStore.getState().clearSelection();
    input.setVisible(true);
    fetchStore.getState().openMenu({ x: dog.x, y: dog.y });
  });
  input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
    event.stopPropagation();
    if (fetchStore.getState().phase === "running") aim(pointer.worldX, pointer.worldY);
  });
  input.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
    event.stopPropagation();
    aim(pointer.worldX, pointer.worldY); throwStick();
  });
  const keyboard = (event: KeyboardEvent) => {
    if (fetchStore.getState().phase === "idle") return;
    if (event.key === "Escape") { fetchStore.getState().set("idle"); return; }
    if (fetchStore.getState().phase !== "running") return;
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(event.key)) return;
    event.preventDefault();
    if (event.key === " ") throwStick();
    else aim(target.x + (event.key === "ArrowLeft" ? -12 : event.key === "ArrowRight" ? 12 : 0),
      target.y + (event.key === "ArrowUp" ? -12 : event.key === "ArrowDown" ? 12 : 0));
  };
  const messages = { behind: "Too late! The stick landed behind the dog.", wide: "A little too far sideways! Aim along the dog's path.",
    too_far: "Too far! The dog stopped before reaching the stick.", stopped: "The dog stopped before the stick landed." };
  const update = (_time: number, delta: number) => {
    if (marketUiStore.getState().location !== "farm") return;
    const phase = fetchStore.getState().phase;
    if (phase === "idle" && placed) {
      const farmer = farmerPosition();
      if (Math.hypot(dog.x - farmer.x, dog.y - farmer.y) <= TILE_SIZE) {
        if (walk?.kind === "follow") { walk = null; sit(); }
        else if (!walk) sit();
      } else if (!walk && scene.time.now >= nextFollowCheck) {
        nextFollowCheck = scene.time.now + 150;
        const path = planDogFollow(dog, farmer, walkBounds(), isClear, TILE_SIZE);
        // Replan at each tile centre so turns never cut through blocked corners.
        if (path.length) walkTo([path[0]!], () => undefined, "follow");
        else sit();
      }
    }
    if (walk) {
      const destination = walk.points[walk.index]!;
      const column = Math.floor(destination.x / TILE_SIZE), row = Math.floor(destination.y / TILE_SIZE);
      if (!isClear(column, row) && (column !== Math.floor(dog.x / TILE_SIZE) || row !== Math.floor(dog.y / TILE_SIZE))) {
        if (walk.kind === "follow") { walk = null; sit(); return; }
        clear();
        fetchStore.getState().set("idle");
        notify("The dog's path changed. Click the dog to try again.");
        return;
      }
      const dx = destination.x - dog.x, dy = destination.y - dog.y;
      const distance = Math.hypot(dx, dy);
      const step = Math.min(distance, Math.min(delta, 50) * 0.12);
      if (dx !== 0) dog.setFlipX(dx < 0);
      if (distance > 0) dog.setPosition(dog.x + dx / distance * step, dog.y + dy / distance * step);
      if (distance <= step) {
        walk.index++;
        if (walk.index === walk.points.length) {
          const done = walk.done;
          walk = null;
          done();
        }
      }
      return;
    }
    if (!run || phase === "idle" || phase === "menu" || phase === "result") {
      const next = advanceDogGlance(glance, scene.time.now,
        dog.visible && dog.texture.key === spriteName("dogSitting"), dog.flipX, glanceDelay());
      glance = next.state;
      dog.setFlipX(next.flipX);
      return;
    }
    const elapsed = scene.time.now - startedAt;
    const position = fetchPosition(run, elapsed);
    dog.setPosition(position.x, position.y - (elapsed < run.duration ? Math.abs(Math.sin(elapsed / 110)) * 3 : 0));
    graphics.clear();
    if (phase === "running") {
      if (elapsed > run.duration * 0.75 && !fetchStore.getState().message.includes("slowing")) {
        fetchStore.getState().set("running", "The dog is slowing down—throw nearby, quickly!");
      }
      const origin = farmerPosition();
      const angle = Math.atan2(target.y - origin.y, target.x - origin.x);
      graphics.lineStyle(3, 0xffd85a).lineBetween(origin.x, origin.y, target.x, target.y);
      graphics.fillStyle(0xffd85a).fillTriangle(target.x, target.y,
        target.x - 14 * Math.cos(angle - 0.5), target.y - 14 * Math.sin(angle - 0.5),
        target.x - 14 * Math.cos(angle + 0.5), target.y - 14 * Math.sin(angle + 0.5));
      graphics.lineStyle(2, 0xffffff).strokeCircle(target.x, target.y, 10);
      if (elapsed >= run.duration) finish("The dog stopped! Try throwing a little sooner.");
    }
    if (landing && thrownAt !== null) {
      const flight = Math.min(1, (scene.time.now - thrownAt) / FETCH_FLIGHT_MS);
      const stick = { x: throwOrigin.x + (landing.x - throwOrigin.x) * flight,
        y: throwOrigin.y + (landing.y - throwOrigin.y) * flight - Math.sin(flight * Math.PI) * 50 };
      graphics.lineStyle(5, 0x57331b).lineBetween(stick.x - 10, stick.y + 4, stick.x + 10, stick.y - 4);
      if (flight === 1 && !landed) {
        landed = true;
        outcome = evaluateFetchThrow(run, landing, thrownAt - startedAt + FETCH_FLIGHT_MS);
        if (outcome === "behind" || outcome === "wide" || outcome === "stopped") { finish(messages[outcome]); return; }
        fetchStore.getState().set("chasing", "Will the dog reach it?");
      }
      if (landed && outcome === "catchable") {
        const dx = run.end.x - run.start.x, dy = run.end.y - run.start.y;
        if ((position.x - landing.x) * dx + (position.y - landing.y) * dy >= 0) {
          graphics.clear(); finish("Good throw! The dog caught the stick!"); return;
        }
      }
      if (landed && elapsed >= run.duration) finish(messages.too_far);
    }
  };
  const unsubscribe = fetchStore.subscribe((state, previous) => {
    if (state.phase === previous.phase) return;
    if (state.phase === "starting") start();
    if (state.phase === "idle") clear();
  });
  const unsubscribeLocation = marketUiStore.subscribe((state, previous) => {
    if (state.location !== previous.location) { resetGlance(); fetchStore.getState().set("idle"); }
  });
  const unsubscribeGrid = gridStore.subscribe(() => {
    if (run && fetchStore.getState().phase !== "idle") {
      const stillClear = routes().some(r => r.start.x === run!.start.x && r.start.y === run!.start.y &&
        (r.end.x - r.start.x) * (run!.end.x - run!.start.x) + (r.end.y - r.start.y) * (run!.end.y - run!.start.y) > 0 &&
        Math.hypot(r.end.x - r.start.x, r.end.y - r.start.y) >= Math.hypot(run!.end.x - run!.start.x, run!.end.y - run!.start.y));
      if (stillClear) return;
      fetchStore.getState().set("idle");
      notify("The path changed. Click the dog to start a new round.");
    }
    if (fetchStore.getState().phase === "idle") place();
  });
  const resize = () => { clear(); fetchStore.getState().set("idle"); input.setSize(scene.scale.width, scene.scale.height); place(); };
  scene.input.keyboard?.on("keydown", keyboard);
  scene.events.on(Phaser.Scenes.Events.UPDATE, update);
  scene.scale.on(Phaser.Scale.Events.RESIZE, resize);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    unsubscribe(); unsubscribeLocation(); unsubscribeGrid(); clear(); fetchStore.getState().set("idle");
    scene.input.keyboard?.off("keydown", keyboard);
    scene.events.off(Phaser.Scenes.Events.UPDATE, update);
    scene.scale.off(Phaser.Scale.Events.RESIZE, resize);
  });
  place();
};
