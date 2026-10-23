import type Phaser from "phaser";

export const CLOUD_TEXTURES = ["ambient-cloud-fluffy", "ambient-cloud-wispy", "ambient-cloud-wide", "ambient-cloud-small"] as const;
export const CLOUD_CYCLE_MS = 120_000;
export type CloudStyle = { readonly lane: number; readonly size: number; readonly alpha: number; readonly shape: number };
export const randomCloudStyle = (random = Math.random): CloudStyle => ({
  lane: 0.18 + random() * 0.58, size: 0.24 + random() * 0.1, alpha: 0.24 + random() * 0.06,
  shape: Math.min(3, Math.floor(random() * 4)),
});

type Cloud = { readonly progress: number; readonly style: CloudStyle };
export type CloudState = { readonly clouds: readonly Cloud[]; readonly nextIn: number };
export const initialClouds = (random = Math.random): CloudState => ({
  clouds: [{ progress: 0.35, style: randomCloudStyle(random) }], nextIn: 20_000 + random() * 10_000,
});
/** Random arrivals overlap comfortably; at most three slots, never a sudden mid-screen spawn. */
export const advanceClouds = (state: CloudState, delta: number, random = Math.random): CloudState => {
  const clouds = state.clouds.map(cloud => ({ ...cloud, progress: cloud.progress + delta / CLOUD_CYCLE_MS }))
    .filter(cloud => cloud.progress < 1);
  const nextIn = state.nextIn - delta;
  return nextIn <= 0 && clouds.length < 3
    ? { clouds: [...clouds, { progress: 0, style: randomCloudStyle(random) }], nextIn: 30_000 + random() * 18_000 }
    : { clouds, nextIn };
};

export const cloudPose = (phase: number, width: number, height: number, style: CloudStyle) => {
  const size = Math.min(380, width * style.size);
  // Preserve the approved two-minute crossing speed and viewport-relative scale.
  const margin = Math.min(190, width * 0.17);
  return { x: -margin + phase * (width + margin * 2), y: height * style.lane,
    width: size, height: size / 2, alpha: style.alpha };
};

/** Procedural soft white puffs; no external artwork or per-frame texture generation. */
export const prepareCloudTexture = (scene: Phaser.Scene) => {
  const shapes = [
    [[85, 113, 57, 36], [133, 85, 59, 51], [196, 70, 65, 55], [252, 97, 64, 44], [300, 119, 56, 30], [189, 126, 110, 37]],
    [[76, 118, 58, 19], [143, 100, 76, 29], [216, 90, 70, 31], [290, 105, 66, 22], [202, 120, 105, 20]],
    [[67, 117, 48, 31], [116, 91, 55, 42], [180, 108, 65, 35], [238, 75, 58, 51], [302, 108, 56, 36], [205, 131, 112, 28]],
    [[108, 116, 67, 34], [165, 70, 60, 51], [225, 88, 67, 51], [279, 119, 58, 29], [190, 125, 100, 32]],
  ];
  CLOUD_TEXTURES.forEach((key, index) => {
  if (scene.textures.exists(key)) return;
  const canvas = document.createElement("canvas");
  canvas.width = 384; canvas.height = 192;
  const context = canvas.getContext("2d")!;
  const puffs = shapes[index]!;
  for (const [x, y, rx, ry] of puffs) {
    context.save(); context.translate(x!, y!); context.scale(rx!, ry!);
    const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 1);
    gradient.addColorStop(0, "rgba(255,250,239,1)");
    gradient.addColorStop(0.65, "rgba(255,250,239,0.9)");
    gradient.addColorStop(1, "rgba(255,250,239,0)");
    context.fillStyle = gradient; context.fillRect(-1, -1, 2, 2); context.restore();
  }
  scene.textures.addCanvas(key, canvas);
  });
};

/** Scene-owned presentation sharing the farm's cloud simulation and viewport scale. */
export const createAmbientCloudLayer = (scene: Phaser.Scene) => {
  prepareCloudTexture(scene);
  let state = initialClouds();
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const sprites = Array.from({ length: 3 }, () =>
    scene.add.image(0, 0, CLOUD_TEXTURES[0]).setDepth(10010).setVisible(false));
  return {
    update(delta: number) {
      if (!document.hidden && !reduced.matches) state = advanceClouds(state, Math.max(0, Math.min(delta, 80)));
      const camera = scene.cameras.main;
      sprites.forEach((sprite, index) => {
        const cloud = state.clouds[index];
        sprite.setVisible(!!cloud);
        if (!cloud) return;
        const pose = cloudPose(cloud.progress, camera.width, camera.height, cloud.style);
        const point = camera.getWorldPoint(pose.x, pose.y);
        sprite.setTexture(CLOUD_TEXTURES[cloud.style.shape]!).setPosition(point.x, point.y)
          .setDisplaySize(pose.width / camera.zoom, pose.height / camera.zoom).setAlpha(pose.alpha);
      });
    },
    destroy() { sprites.forEach(sprite => sprite.destroy()); },
  };
};
