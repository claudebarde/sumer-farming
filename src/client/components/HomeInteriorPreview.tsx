import { useEffect, useRef } from "react";
import type { FurniturePlacement, FurnitureKey } from "../../game-data/homeFurniture";
import { furnitureDepth, furniturePosition } from "../../game-core/home/furnitureSurfaces";
import { FURNITURE_ARTWORK } from "../game/home/furnitureArtwork";
import { prepareFurnitureTexture, placedFurnitureTexture } from "../game/home/furnitureTexture";
import { HOME_TABLETS, prepareWallTabletTexture, type HomeTabletKey } from "../game/phaser/homeTablets";
import interiorArtwork from "../../assets/sprite_assets/pngs/v2/isometric-test/home-interior/courtyard-empty.png";

const loadImage = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image); image.onerror = reject; image.src = url;
});
const frames = new Map<FurnitureKey, Promise<HTMLCanvasElement>>();
const frameFor = (key: FurnitureKey) => {
  const existing = frames.get(key);
  if (existing) return existing;
  const frame = loadImage(FURNITURE_ARTWORK[key]).then(image => prepareFurnitureTexture(image, key))
    .catch(error => { frames.delete(key); throw error; });
  frames.set(key, frame);
  return frame;
};

/** A static saved-layout preview, without booting another Phaser renderer. */
export default function HomeInteriorPreview({ furniture, tablet }: {
  readonly furniture: readonly FurniturePlacement[]; readonly tablet: HomeTabletKey;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      const layers = [...furniture].sort((a, b) => furnitureDepth(a, furniture) - furnitureDepth(b, furniture));
      const selectedTablet = HOME_TABLETS.find(item => item.key === tablet);
      const [house, objects, wallTablet] = await Promise.all([
        loadImage(interiorArtwork),
        Promise.all(layers.map(item => frameFor(item.key))),
        selectedTablet ? loadImage(selectedTablet.source) : Promise.resolve(null),
      ]);
      if (cancelled || !canvas.current) return;
      const context = canvas.current.getContext("2d")!;
      context.clearRect(0, 0, 1536, 1024);
      context.drawImage(house, 0, 0, 1536, 1024);
      layers.forEach((item, index) => {
        const texture = placedFurnitureTexture(objects[index]!, item, furniture);
        const position = furniturePosition(item, furniture);
        context.drawImage(texture, position.x - texture.width / 2, position.y - texture.height * .78);
      });
      if (wallTablet) context.drawImage(prepareWallTabletTexture(wallTablet), 840, 860, 80, 80);
    };
    void render().catch(() => { /* Keep the house background visible if an asset fails to load. */ });
    return () => { cancelled = true; };
  }, [furniture, tablet]);
  return <canvas ref={canvas} width={1536} height={1024} role="img"
    aria-label="Your house interior with saved furniture and decorations"
    style={{ backgroundImage: `url(${interiorArtwork})`, backgroundSize: "contain", backgroundRepeat: "no-repeat" }} />;
}
