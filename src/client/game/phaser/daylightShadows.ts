import { ISO_WIDTH, ISO_HEIGHT } from "./isometricProjection";

export const SHADOW_PRESETS = ["local", "morning", "midday", "evening", "night"] as const;
export type ShadowPreset = typeof SHADOW_PRESETS[number];
export type ShadowBounds = { minimumColumn: number; maximumColumn: number; minimumRow: number; maximumRow: number };
const presetHours = { morning: 9, midday: 14, evening: 19, night: 22 } as const;

/** Local time is cosmetic only; never use it for production or progression. */
export const shadowHour = (preset: ShadowPreset, date: Date) => preset === "local"
  ? date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600
  : presetHours[preset];

export const daylightShadow = (hour: number) => {
  const phase = Math.max(0, Math.min(1, (hour - 8) / 12));
  const daylight = Math.max(0, Math.min(1, (hour - 8) * 2, (20 - hour) * 2));
  // Logical east → north → west sun; shadow points in the opposite direction.
  const column = -Math.cos(phase * Math.PI), row = Math.sin(phase * Math.PI);
  return {
    phase,
    x: (column - row) / Math.SQRT2,
    y: (column + row) / Math.SQRT2,
    length: daylight * (0.2 + 0.8 * Math.abs(Math.cos(phase * Math.PI))),
    alpha: 0.1 + daylight * 0.1,
  };
};

/** Project a ground-plane oval, including its rotation, into the 2:1 view. */
export const shadowEllipse = (sun: ReturnType<typeof daylightShadow>, width: number, height: number) => {
  const extension = height * sun.length;
  const major = (width + extension) / 2, minor = width / 2;
  const difference = major * major - minor * minor;
  const a = minor * minor + difference * sun.x * sun.x;
  const b = difference * sun.x * sun.y / 2;
  const d = (minor * minor + difference * sun.y * sun.y) / 4;
  const radius = Math.hypot(a - d, 2 * b);
  return {
    x: sun.x * extension / 2, y: sun.y * extension / 4,
    width: 2 * Math.sqrt((a + d + radius) / 2),
    height: 2 * Math.sqrt((a + d - radius) / 2),
    rotation: Math.atan2(2 * b, a - d) / 2,
    alpha: sun.alpha,
  };
};

/** Clip a convex ground polygon in logical tile space, including half-tile edges. */
export const clipShadow = (points: readonly { x: number; y: number }[], bounds: ShadowBounds) => {
  let result = points.map(p => ({ x: p.x / ISO_WIDTH + p.y / ISO_HEIGHT, y: p.y / ISO_HEIGHT - p.x / ISO_WIDTH }));
  const edges = [
    { axis: "x", limit: bounds.minimumColumn - 0.5, sign: 1 },
    { axis: "x", limit: bounds.maximumColumn + 0.5, sign: -1 },
    { axis: "y", limit: bounds.minimumRow - 0.5, sign: 1 },
    { axis: "y", limit: bounds.maximumRow + 0.5, sign: -1 },
  ] as const;
  for (const { axis, limit, sign } of edges) {
    const input = result; result = [];
    for (let i = 0; i < input.length; i++) {
      const a = input[i]!, b = input[(i + 1) % input.length]!;
      const insideA = (a[axis] - limit) * sign >= 0, insideB = (b[axis] - limit) * sign >= 0;
      if (insideA) result.push(a);
      if (insideA !== insideB) {
        const t = (limit - a[axis]) / (b[axis] - a[axis]);
        result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    }
  }
  return result.map(p => ({ x: (p.x - p.y) * ISO_WIDTH / 2, y: (p.x + p.y) * ISO_HEIGHT / 2 }));
};
