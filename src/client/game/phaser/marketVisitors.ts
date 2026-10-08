import type Phaser from "phaser";
import { spriteName } from "../../../assets/farmSprites";
import type { RoadCoordinate } from "../../../game-core/farm/roads";
import type { MarketVisitor } from "../../../schemas/marketPresence";
import { TILE_SIZE } from "./config";
import { decodeMarketPosition } from "./marketPresencePosition";
import { marketWalkingPath } from "./marketSceneLayout";

/** Presentation only: snapshots never alter a neighbour's farm or inventory. */
export const createMarketVisitors = (scene: Phaser.Scene, columns: number) => {
  type Actor = { image: Phaser.GameObjects.Image; name: Phaser.GameObjects.Text;
    tile: RoadCoordinate; target: RoadCoordinate; tween: Phaser.Tweens.Tween | null };
  const actors = new Map<string, Actor>();
  const placeLabel = (actor: Actor) => {
    actor.name.setPosition(actor.image.x, actor.image.y - TILE_SIZE * 0.85);
  };
  const walk = (actor: Actor): void => {
    if (actor.tween) return;
    const next = marketWalkingPath(columns, actor.tile, actor.target)?.[1];
    if (!next) { actor.image.setTexture(spriteName("farmerIdle0")).setDisplaySize(TILE_SIZE, TILE_SIZE); return; }
    if (next.column !== actor.tile.column) actor.image.setFlipX(next.column < actor.tile.column);
    actor.tween = scene.tweens.add({ targets: actor.image,
      x: (next.column + 0.5) * TILE_SIZE, y: (next.row + 0.5) * TILE_SIZE, duration: 180, ease: "Linear",
      onUpdate: () => {
        actor.image.setTexture(spriteName((["farmerWalk0", "farmerWalk1", "farmerWalk2", "farmerWalk3"] as const)[Math.floor(scene.time.now / 100) % 4]!))
          .setDisplaySize(TILE_SIZE, TILE_SIZE);
        placeLabel(actor);
      },
      onComplete: () => { actor.tween = null; actor.tile = next; placeLabel(actor); walk(actor); }
    });
  };
  const remove = (id: string, actor: Actor) => {
    actor.tween?.stop(); actor.image.destroy(); actor.name.destroy(); actors.delete(id);
  };
  return {
    sync: (visitors: readonly MarketVisitor[]) => {
      const present = new Set(visitors.map(visitor => visitor.playerId));
      for (const [id, actor] of actors) if (!present.has(id)) remove(id, actor);
      for (const visitor of visitors) {
        const target = decodeMarketPosition(visitor.position, columns);
        let actor = actors.get(visitor.playerId);
        if (!actor) {
          actor = { tile: target, target, tween: null,
            image: scene.add.image((target.column + 0.5) * TILE_SIZE, (target.row + 0.5) * TILE_SIZE, spriteName("farmerIdle0"))
              .setOrigin(0.5, 1).setDisplaySize(TILE_SIZE, TILE_SIZE).setDepth(1),
            name: scene.add.text(0, 0, visitor.name, { fontFamily: "Bree Serif, Georgia, serif", fontSize: "12px",
              color: "#352116", backgroundColor: "#fff6e6", padding: { x: 4, y: 2 } }).setOrigin(0.5, 1).setDepth(2)
          };
          actors.set(visitor.playerId, actor);
          placeLabel(actor);
        }
        actor.target = target;
        actor.name.setText(visitor.name);
        walk(actor);
      }
    },
    destroy: () => { for (const [id, actor] of actors) remove(id, actor); }
  };
};
