import { middayBuildingOval } from "./buildingShadowProjection";
import { daylightShadow } from "./daylightShadows";

export const usesConeBuildingShadow = (texture: string) => texture === "smallShrine" || /^brewery(?:-right-top-full)?(?:-[01])?$/.test(texture);

/** Parallel light projects a solid cone to the convex hull of its base disk
 * and projected apex. If the apex lands inside the disk, only the disk remains. */
export const coneShadowProfile = (radius: number, apexDistance: number) => ({
  radius,
  apexDistance,
  tangentAngle: apexDistance > radius ? Math.acos(radius / apexDistance) : null,
});

/** Shared sun direction and elevation ratio, applied to an upright cone. */
export const coneBuildingShadowShape = (hour: number, width: number, height: number) => {
  const sun = daylightShadow(hour);
  return { x: sun.x, y: sun.y, length: height * sun.length,
    base: width / 2,
    alpha: sun.alpha };
};

export const drawConeBuildingShadow = (context: CanvasRenderingContext2D, hour: number,
  building: Parameters<typeof middayBuildingOval>[0] & { alpha: number },
  frame: Parameters<typeof middayBuildingOval>[1] & { top: number }) => {
  const contact = middayBuildingOval(building, frame);
  if (!contact) return;
  const width = (contact.radiusX - 6) * 2;
  // Anchor the circular base at the building's ground contact; in this 2:1
  // projection the circle's southern edge is radius / 2 below its centre.
  const radius = width / 2;
  const centreY = building.y + (frame.bottom / frame.height - building.originY) * building.displayHeight - radius / 2;
  const topY = building.y + (frame.top / frame.height - building.originY) * building.displayHeight;
  const shape = coneBuildingShadowShape(hour, width, Math.max(0, centreY - topY));
  context.save();
  context.translate(contact.x, centreY);
  context.scale(1, 0.5);
  context.rotate(Math.atan2(shape.y, shape.x));
  context.fillStyle = "#504739";
  // Several translucent nested contours feather the edge without a hard cone tip.
  for (const scale of [1.08, 1.04, 1, 0.96]) {
    const profile = coneShadowProfile(shape.base * scale, shape.length);
    // Four overlapping layers must composite to the shared shadow opacity.
    context.globalAlpha = 1 - Math.pow(1 - shape.alpha * building.alpha, 1 / 4);
    context.beginPath();
    if (profile.tangentAngle === null) {
      context.arc(0, 0, profile.radius, 0, Math.PI * 2);
    } else {
      const angle = profile.tangentAngle;
      context.moveTo(profile.apexDistance, 0);
      context.lineTo(profile.radius * Math.cos(angle), profile.radius * Math.sin(angle));
      context.arc(0, 0, profile.radius, angle, Math.PI * 2 - angle);
      context.closePath();
    }
    context.fill();
  }
  context.restore();
  context.save(); context.globalAlpha = 0.055 * building.alpha;
  context.fillStyle = "#504739"; context.beginPath();
  context.ellipse(contact.x, centreY, width * 0.44, width * 0.14, 0, 0, Math.PI * 2);
  context.fill(); context.restore();
};
