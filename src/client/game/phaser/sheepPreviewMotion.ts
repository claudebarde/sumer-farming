export type SheepPoint = { readonly x: number; readonly y: number };
export type PreviewSheep = {
  readonly position: SheepPoint;
  readonly flip: boolean;
  readonly action: { readonly type: "walk"; readonly target: SheepPoint; readonly elapsed: number }
    | { readonly type: "graze"; readonly elapsed: number; readonly duration: number }
    | { readonly type: "idle"; readonly remaining: number };
};
// Inset for the whole animal, including the lowered head in either facing.
export const sheepPreviewInside = (p: SheepPoint) => Math.abs(p.x) + 2 * Math.abs(p.y) <= 48;
export const sheepPreviewSeparated = (a: SheepPoint, b: SheepPoint) => ((a.x - b.x) / 21) ** 2 + ((a.y - b.y) / 10) ** 2 >= 1;
export const initialPreviewSheep = (): PreviewSheep[] => [
  { x: -27, y: -5 }, { x: 0, y: 15 }, { x: 27, y: -5 },
].map((position, i) => ({ position, flip: i === 0, action: { type: "idle", remaining: i * 800 } }));

export const advancePreviewSheep = (herd: readonly PreviewSheep[], delta: number, random = Math.random): PreviewSheep[] => {
  const dt = Math.min(80, Math.max(0, delta));
  const next = [...herd];
  next.forEach((sheep, i) => {
    const clear = (p: SheepPoint) => sheepPreviewInside(p) && next.every((other, j) => j === i || sheepPreviewSeparated(p, other.position));
    const graze = (): PreviewSheep => ({ ...sheep, action: { type: "graze", elapsed: 0, duration: 4000 + random() * 3000 } });
    if (sheep.action.type === "walk") {
      const { target, elapsed } = sheep.action;
      const dx = target.x - sheep.position.x, dy = target.y - sheep.position.y;
      const distance = Math.hypot(dx, dy), step = Math.min(distance, dt * .010);
      const position = distance === 0 ? target : { x: sheep.position.x + dx / distance * step, y: sheep.position.y + dy / distance * step };
      // Stop the gait too when blocked; never cycle walking frames in place.
      next[i] = !clear(position) ? { ...sheep, action: { type: "idle", remaining: 500 + random() * 700 } }
        : step === distance ? { ...graze(), position }
        : { ...sheep, position, action: { ...sheep.action, elapsed: elapsed + dt } };
      return;
    }
    if (sheep.action.type === "graze" && sheep.action.elapsed + dt < sheep.action.duration) {
      next[i] = { ...sheep, action: { ...sheep.action, elapsed: sheep.action.elapsed + dt } }; return;
    }
    if (sheep.action.type === "idle" && sheep.action.remaining > dt) {
      next[i] = { ...sheep, action: { type: "idle", remaining: sheep.action.remaining - dt } }; return;
    }
    for (let attempt = 0; attempt < 50; attempt++) {
      const target = { x: random() * 88 - 44, y: random() * 40 - 20 };
      const dx = target.x - sheep.position.x, dy = target.y - sheep.position.y;
      // Current side-facing artwork supports mostly lateral movement.
      if (Math.abs(dx) < 12 || Math.abs(dy) > Math.abs(dx) * .35 || !clear(target)) continue;
      if (!Array.from({ length: 17 }, (_, j) => ({ x: sheep.position.x + dx * j / 16, y: sheep.position.y + dy * j / 16 })).every(clear)) continue;
      next[i] = { ...sheep, flip: dx > 0, action: { type: "walk", target, elapsed: 0 } }; return;
    }
    next[i] = graze();
  });
  return next;
};
