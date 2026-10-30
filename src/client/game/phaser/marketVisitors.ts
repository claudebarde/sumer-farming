import Phaser from "phaser";
import type { MarketPosition, MarketVisitor } from "../../../schemas/marketPresence";
import { MARKET_PRESENCE_POLL_MS } from "../../../schemas/marketPresence";
import { advanceMarketVisitor, marketVisitorPath } from "./marketVisitorMotion";
import { farmerTravelTexture } from "./farmerCarry";
import { farmerObscured, hiddenFarmerBounce, walkingCharacterDepth, type OcclusionSprite } from "./farmerOcclusion";
import { isoPoint, ISO_HEIGHT, ISO_WIDTH } from "./isometricProjection";

export const createMarketVisitors = (scene: Phaser.Scene, buildings: () => readonly Phaser.GameObjects.Image[]) => {
  type Visitor = { position: MarketPosition; path: readonly MarketPosition[]; speed: number; distance: number;
    actor: Phaser.GameObjects.Image; name: Phaser.GameObjects.Text; shadow: Phaser.GameObjects.Ellipse; marker: Phaser.GameObjects.Graphics };
  const visitors = new Map<string, Visitor>();
  const masks = new Map<string, ImageData>();
  const occlusion = (sprite: Phaser.GameObjects.Image): OcclusionSprite => {
    let pixels = masks.get(sprite.texture.key);
    if (!pixels) {
      const source = sprite.texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
      const canvas = document.createElement("canvas"); canvas.width = source.width; canvas.height = source.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(source, 0, 0); pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
      masks.set(sprite.texture.key, pixels);
    }
    const mask = pixels, bounds = sprite.getBounds();
    return { left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height, depth: sprite.depth,
      opaqueAt: (u, v) => {
        const x = Math.min(mask.width - 1, Math.floor((sprite.flipX ? 1 - u : u) * mask.width));
        const y = Math.min(mask.height - 1, Math.floor(v * mask.height));
        return (mask.data[(y * mask.width + x) * 4 + 3] ?? 0) * sprite.alpha >= 64;
      } };
  };
  const remove = (id: string, visitor: Visitor) => {
    visitor.actor.destroy(); visitor.name.destroy(); visitor.shadow.destroy(); visitor.marker.destroy(); visitors.delete(id);
  };
  return {
    receive(incoming: readonly MarketVisitor[]) {
      const ids = new Set(incoming.map(v => v.playerId));
      for (const [id, visitor] of visitors) if (!ids.has(id)) remove(id, visitor);
      for (const entry of incoming) {
        let visitor = visitors.get(entry.playerId);
        if (!visitor) {
          const marker = scene.add.graphics().setDepth(10001).setVisible(false);
          const arrow = [{ x: -4, y: -20 }, { x: 4, y: -20 }, { x: 4, y: -11 }, { x: 10, y: -11 },
            { x: 0, y: 0 }, { x: -10, y: -11 }, { x: -4, y: -11 }].map(p => new Phaser.Math.Vector2(p.x, p.y));
          marker.fillStyle(0xffd568).fillPoints(arrow, true).lineStyle(2, 0x624728).strokePoints(arrow, true);
          visitor = { position: entry.position, path: [], speed: 0, distance: 0, marker,
            actor: scene.add.image(0, 0, "farmer-idle").setOrigin(0.5, 120 / 128).setDisplaySize(64, 64),
            shadow: scene.add.ellipse(0, 0, 23, 8, 0x624728, 0.18),
            name: scene.add.text(0, 0, entry.name, { fontFamily: "Georgia, serif", fontSize: "12px",
              color: "#382519", backgroundColor: "#fff7e8", padding: { x: 4, y: 2 } })
              .setOrigin(0.5, 1).setResolution(2).setDepth(10002)
          };
          visitors.set(entry.playerId, visitor);
        }
        visitor.name.setText(entry.name);
        visitor.path = marketVisitorPath(visitor.position, entry.position);
        const length = visitor.path.reduce((sum, point, i, path) => {
          const previous = i ? path[i - 1]! : visitor!.position;
          return sum + Math.abs(point.column - previous.column) + Math.abs(point.row - previous.row);
        }, 0);
        visitor.speed = length / MARKET_PRESENCE_POLL_MS;
      }
    },
    update(delta: number, reducedMotion: boolean) {
      if (!visitors.size) return;
      const obstacles = buildings().filter(b => b.visible).map(occlusion);
      for (const visitor of visitors.values()) {
        const movement = advanceMarketVisitor(visitor.position, visitor.path, visitor.speed * Math.min(delta, 80));
        visitor.position = movement.position; visitor.path = movement.path;
        visitor.distance += movement.travelled * Math.hypot(ISO_WIDTH / 2, ISO_HEIGHT / 2);
        const point = isoPoint(visitor.position);
        visitor.actor.setPosition(point.x, point.y).setDepth(walkingCharacterDepth(point.y))
          .setTexture(farmerTravelTexture(visitor.distance, 0, !reducedMotion && movement.travelled > 0)).setDisplaySize(64, 64);
        if (movement.flipX !== null) visitor.actor.setFlipX(movement.flipX);
        visitor.shadow.setPosition(point.x, point.y).setDepth(point.y);
        const hidden = farmerObscured(occlusion(visitor.actor), obstacles);
        visitor.marker.setVisible(hidden).setPosition(point.x, point.y - 63 + hiddenFarmerBounce(Date.now(), reducedMotion));
        visitor.name.setPosition(point.x, point.y - (hidden ? 88 : 60));
      }
    },
    destroy() { for (const [id, visitor] of visitors) remove(id, visitor); masks.clear(); }
  };
};
