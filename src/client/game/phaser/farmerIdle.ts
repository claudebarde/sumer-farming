import { z } from "zod";

export type IdlePoint = Readonly<{ column: number; row: number }>;
export const idleKey = (p: IdlePoint) => `${p.column}:${p.row}`;
const distance = (a: IdlePoint, b: IdlePoint) => Math.abs(a.column - b.column) + Math.abs(a.row - b.row);
const neighbors = (p: IdlePoint): IdlePoint[] => [
  { column: p.column - 1, row: p.row }, { column: p.column + 1, row: p.row },
  { column: p.column, row: p.row - 1 }, { column: p.column, row: p.row + 1 }
];
export type IdleWorld = { readonly roads: ReadonlySet<string>; readonly allowed: (p: IdlePoint) => boolean; readonly occupied?: IdlePoint };

/** One cardinal step, never leaving the two-tile neighbourhood of the last task. */
export const chooseIdleStep = (position: IdlePoint, anchor: IdlePoint, world: IdleWorld, random: number): IdlePoint | null => {
  const allowed = (p: IdlePoint) => distance(p, anchor) <= 2 && world.allowed(p) &&
    (!world.occupied || distance(p, world.occupied) !== 0);
  const next = neighbors(position).filter(allowed);
  if (world.roads.has(idleKey(position))) {
    const choices = next.filter(p => world.roads.has(idleKey(p)));
    return choices[Math.min(choices.length - 1, Math.floor(random * choices.length))] ?? null;
  }
  // Find a short safe route back to a road, not a straight line through buildings.
  const queue = next.map(p => [p]);
  const seen = new Set([idleKey(position), ...next.map(idleKey)]);
  for (let i = 0; i < queue.length; i++) {
    const path = queue[i]!;
    const end = path.at(-1)!;
    if (world.roads.has(idleKey(end))) return path[0]!;
    for (const p of neighbors(end).filter(allowed)) {
      if (seen.has(idleKey(p))) continue;
      seen.add(idleKey(p)); queue.push([...path, p]);
    }
  }
  return null;
};

const pointSchema = z.object({ column: z.number().int(), row: z.number().int() });
const savedSchema = z.object({ position: pointSchema, anchor: pointSchema, due: z.number().finite(), version: z.number().int() });
type Rest = z.infer<typeof savedSchema>;
type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;

export const createFarmerIdle = (options: {
  readonly key: string;
  readonly storage?: Storage;
  readonly random?: () => number;
  readonly present: (position: IdlePoint, moving: boolean) => void;
}) => {
  const random = options.random ?? Math.random;
  let rest: Rest | null = null;
  let motion: { from: IdlePoint; to: IdlePoint; at: number } | null = null;
  let loaded = false;
  let returning = false;
  let lastTick = 0;
  const delay = () => 60_000 + random() * 60_000;
  const save = () => { try { if (rest) options.storage?.setItem(options.key, JSON.stringify(rest)); else options.storage?.removeItem(options.key); } catch { /* Cosmetic persistence is optional. */ } };
  const finish = (now?: number) => {
    if (!motion || !rest) return;
    rest = { ...rest, position: motion.to, due: now === undefined ? rest.due : now + delay() };
    motion = null;
    options.present(rest.position, false); save();
  };
  return {
    cancel: () => {
      const hadRest = rest !== null || !loaded;
      if (motion) options.present(motion.from, false);
      motion = null; rest = null; loaded = true; if (hadRest) save();
    },
    suspend: () => { finish(); returning = true; },
    update: (input: { now: number; version: number; eligible: boolean; visible: boolean; position: IdlePoint; world: IdleWorld }) => {
      if (!input.visible) { returning = true; return; }
      if (!input.eligible) {
        const hadRest = rest !== null || !loaded;
        if (motion) options.present(motion.from, false);
        motion = null; rest = null; loaded = true; if (hadRest) save(); lastTick = input.now; return;
      }
      let snap = returning || (lastTick > 0 && input.now - lastTick > 5000);
      returning = false; lastTick = input.now;
      if (!loaded) {
        loaded = true;
        try {
          const parsed = savedSchema.safeParse(JSON.parse(options.storage?.getItem(options.key) ?? "null"));
          if (parsed.success && parsed.data.version === input.version && input.world.allowed(parsed.data.position) &&
            (!input.world.occupied || distance(parsed.data.position, input.world.occupied) !== 0) &&
            distance(parsed.data.anchor, parsed.data.position) <= 2) {
            rest = parsed.data; options.present(rest.position, false); snap = true;
          }
        } catch { /* Ignore old or unavailable local storage. */ }
      }
      if (!rest) { rest = { position: input.position, anchor: input.position, version: input.version, due: input.now + delay() }; save(); return; }
      if (motion) {
        const t = Math.min(1, (input.now - motion.at) / 1800);
        if (t >= 1 || snap) finish(input.now);
        else options.present({ column: motion.from.column + (motion.to.column - motion.from.column) * t,
          row: motion.from.row + (motion.to.row - motion.from.row) * t }, true);
        return;
      }
      if (input.now < rest.due) return;
      const next = chooseIdleStep(rest.position, rest.anchor, input.world, random());
      rest = { ...rest, due: input.now + delay(), version: input.version }; save();
      if (!next) return;
      motion = { from: rest.position, to: next, at: input.now };
      if (snap) finish(); else options.present(rest.position, true);
    }
  };
};
