import { shadowEllipse, type daylightShadow } from "./daylightShadows";

export const usesBreweryFarmShadow = (texture: string, hour: number) => (texture === "brewery" || /^brewery-[01]$/.test(texture)) && hour >= 8 && hour < 14;

/** Fit the farmhouse's visible width to the brewery, keeping its proportions
 * and aligning visible ground contact rather than transparent canvas margins. */
export const breweryFarmShadowPlacement = (
  brewery: Parameters<typeof middayBuildingOval>[0],
  target: Parameters<typeof middayBuildingOval>[1],
  farm: Parameters<typeof middayBuildingOval>[0],
  source: Parameters<typeof middayBuildingOval>[1],
) => {
  const targetOval = middayBuildingOval(brewery, target);
  const sourceOval = middayBuildingOval(farm, source);
  if (!targetOval || !sourceOval) return null;
  const scale = (targetOval.radiusX - 6) / (sourceOval.radiusX - 6);
  const displayWidth = farm.displayWidth * scale, displayHeight = farm.displayHeight * scale;
  const base = brewery.y + (target.bottom / target.height - brewery.originY) * brewery.displayHeight;
  return { originX: farm.originX, originY: farm.originY, displayWidth, displayHeight,
    x: targetOval.x - (sourceOval.x - farm.x) * scale,
    // Slide the morning-only proxy slightly beneath the vessels (4 world px
    // at the approved 150px brewery size), without changing its projection.
    y: base - (source.bottom / source.height - farm.originY) * displayHeight - brewery.displayHeight * 4 / 150 };
};

export const usesMorningMillOval = (texture: string, hour: number) =>
  (texture === "mill-v1-base" || texture === "mill-v1-bags") && hour >= 8 && hour < 14;

/** Match the shared sun length using visible artwork height, not transparent padding. */
export const morningMillOval = (
  sun: ReturnType<typeof daylightShadow>,
  sprite: Parameters<typeof middayBuildingOval>[0],
  frame: Parameters<typeof middayBuildingOval>[1] & { top: number },
) => {
  const contact = middayBuildingOval(sprite, frame);
  if (!contact) return null;
  const oval = shadowEllipse(sun, contact.radiusX * 2 - 12,
    (frame.bottom - frame.top) * sprite.displayHeight / frame.height);
  return { ...oval, x: contact.x + oval.x, y: contact.y + oval.y };
};

export const opaqueTop = (rgba: Uint8ClampedArray, width: number, height: number) => {
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (rgba[(y * width + x) * 4 + 3]! >= 32) return y;
  }
  return height;
};

/** Full contact oval at 14:00, easing back to silhouettes by 11:00 / 17:00. */
export const middayShadowWeight = (hour: number) => {
  const amount = Math.max(0, 1 - Math.abs(hour - 14) / 3);
  return amount * amount * (3 - 2 * amount);
};

export const middayBuildingOval = (
  sprite: { x: number; y: number; originX: number; originY: number; displayWidth: number; displayHeight: number },
  frame: { width: number; height: number; bottom: number; contour: readonly number[] },
) => {
  const first = frame.contour.findIndex(bottom => bottom > 0);
  let last = frame.contour.length - 1;
  while (last >= 0 && !frame.contour[last]) last--;
  if (first < 0 || last < first) return null;
  const sx = sprite.displayWidth / frame.width;
  const visibleWidth = (last - first + 1) * sx;
  const baseY = sprite.y + (frame.bottom / frame.height - sprite.originY) * sprite.displayHeight;
  return {
    x: sprite.x - sprite.originX * sprite.displayWidth + (first + last + 1) * sx / 2,
    y: baseY - visibleWidth * 0.16,
    // Small lateral margin and a shallow southern lip, mostly hidden under the building.
    radiusX: visibleWidth / 2 + 6,
    radiusY: visibleWidth * 0.16 + 6,
  };
};

export const usesBuildingBaseContour = (texture: string) =>
  texture.startsWith("farm-level-") || texture === "market-preview" || texture === "mill-v1-base" || texture === "mill-v1-bags" || texture === "breadOven" || texture === "brewery" || /^brewery-[01]$/.test(texture);

/** A separate ground hinge for every visible column preserves isometric corners. */
export const opaqueBaseContour = (rgba: Uint8ClampedArray, width: number, height: number): readonly number[] =>
  Array.from({ length: width }, (_, x) => {
    for (let y = height - 1; y >= 0; y--) if (rgba[(y * width + x) * 4 + 3]! >= 32) return y + 1;
    return 0;
  });

export const buildingShadowContourBottom = (columnBottom: number, originalBottom: number, sun: ReturnType<typeof daylightShadow>) => {
  const afternoon = Math.max(0, Math.min(1, (sun.phase - 0.5) * 12 / 5));
  const blend = afternoon * afternoon * (3 - 2 * afternoon);
  const daylight = sun.length / (0.2 + 0.8 * Math.abs(Math.cos(sun.phase * Math.PI)));
  return originalBottom + (columnBottom - originalBottom) * blend * daylight;
};

/** Contact rows in the prepared texture, not the bottom of props/frontmost corners.
 * Keep these with the artwork calibration: full-frame building textures and the
 * padded warehouse/shrine textures do not share the same transparent margins.
 * The mill body and bags use their individual base contours instead.
 */
export const BUILDING_SHADOW_CONTACT_ROWS: Readonly<Record<string, number>> = {
  // Idle oven now uses its exposed base contour; retain the approved active base.
  "baking-0": 0.76,
  granary: 0.84,
  "market-barley": 0.79,
  "market-beer": 0.79,
  "market-baking": 0.79,
  warehouse: 0.83,
  smallShrine: 0.88,
};

/** Ease the evening projection onto the main structure's ground contact row. */
export const buildingShadowBottom = (texture: string, bottom: number, height: number, sun: ReturnType<typeof daylightShadow>) => {
  const contactRow = BUILDING_SHADOW_CONTACT_ROWS[texture];
  if (contactRow === undefined || sun.phase <= 0.5 || sun.length === 0) return bottom;
  const afternoon = Math.max(0, Math.min(1, (sun.phase - 0.5) * 12 / 5));
  const blend = afternoon * afternoon * (3 - 2 * afternoon);
  const daylight = sun.length / (0.2 + 0.8 * Math.abs(Math.cos(sun.phase * Math.PI)));
  return bottom + (Math.min(bottom, height * contactRow) - bottom) * blend * daylight;
};

/** Affine projection of the alpha silhouette, hinged at its visible bottom edge. */
export const buildingShadowTransform = (
  sun: ReturnType<typeof daylightShadow>,
  sprite: { x: number; y: number; originX: number; originY: number; displayWidth: number; displayHeight: number },
  frame: { width: number; height: number; bottom: number },
) => {
  const sx = sprite.displayWidth / frame.width, sy = sprite.displayHeight / frame.height;
  // Keep the base horizontal and at its actual artwork width. Project the roof
  // away from it, rather than rotating the whole image (and its base) in space.
  const a = sx, b = 0, c = -sun.x * sun.length * sy;
  const afternoon = Math.max(0, Math.min(1, (sun.phase - 0.5) * 12 / 5));
  const blend = afternoon * afternoon * (3 - 2 * afternoon);
  const daylight = sun.length / (0.2 + 0.8 * Math.abs(Math.cos(sun.phase * Math.PI)));
  // In the evening, contact depth extends WITH the projected roof, not against
  // it. The old subtraction flattened the silhouette. Ease into this new
  // projection after midday; preserve morning and fade back to contact at night.
  const d = (0.14 * (1 - 2 * blend * daylight) - sun.y * sun.length * 0.5) * sy;
  const baseY = sprite.y - sprite.originY * sprite.displayHeight + frame.bottom * sy;
  const anchorX = sprite.originX * frame.width;
  return { a, b, c, d,
    e: sprite.x - a * anchorX - c * frame.bottom,
    f: baseY - b * anchorX - d * frame.bottom };
};

export const opaqueBottom = (rgba: Uint8ClampedArray, width: number, height: number) => {
  for (let y = height - 1; y >= 0; y--) for (let x = 0; x < width; x++) {
    if (rgba[(y * width + x) * 4 + 3]! >= 32) return y + 1;
  }
  return height;
};
