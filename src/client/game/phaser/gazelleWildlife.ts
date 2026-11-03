import Phaser from "phaser";
import { gazelleTravelObstacles, gazelleTravelDistance, gazelleTravelPose, GAZELLE_TRAVEL_STEP_MS } from "./gazelleTravel";
import { initialGazelleVisit, advanceGazelleVisit, gazelleVisitAlpha } from "./gazelleVisits";
import { gazelleGrazePose } from "./gazelleMotion";
import { advanceGazelleHerd, createGazelleHerd, type Gazelle } from "./gazelleHerd";
import type { FarmSnapshot } from "../../../schemas/farm";
import { isoPoint } from "./isometricProjection";
import { prepareFarmerTexture } from "./farmerTexture";

const assets = import.meta.glob<string>("../../../assets/sprite_assets/pngs/v2/isometric-test/gazelles/gazelle-*-animations/**/*.png", { eager: true, query: "?url", import: "default" });
const sources = Object.entries(assets).filter(([path]) => !path.includes("-graze-")).map(([path, url]) => ({ key: path.split("/").at(-1)!.replace(".png", ""), url }));
export const preloadGazelles = (scene: Phaser.Scene) => {
  sources.forEach(({ key, url }) => scene.load.image(`source-${key}`, url));
};
const frame = (age: Gazelle["age"], kind: "walk" | "lower" | "chew", index: number) => `gazelle-${age}-${kind}-${String(index + 1).padStart(2,"0")}`;
export const createGazelleWildlife = (scene: Phaser.Scene) => {
  // Use the idle farmer's default texture resolution and sharpening. Shared
  // full-canvas registration keeps the torso and feet stable as the head lowers.
  for (const { key } of sources) if (!scene.textures.exists(key)) {
    const source = scene.textures.get(`source-${key}`).getSourceImage() as HTMLImageElement;
    scene.textures.addCanvas(key, prepareFarmerTexture(source, undefined,
      { left: 0, top: 0, right: source.width - 1, bottom: source.height - 1 }))?.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
  let herd: Gazelle[] = [];
  const images: { sprite: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Ellipse }[] = [];
  let visit = initialGazelleVisit(Math.random);
  let travelDistance=0;
  let obstacles: ReturnType<typeof gazelleTravelObstacles> = [];
  const clear = () => { images.forEach(a=>{a.sprite.destroy();a.shadow.destroy();});images.length=0; };
  return {
    destroy: clear,
    update(delta: number, snapshot: FarmSnapshot, reducedMotion: boolean) {
      if (document.hidden) return;
      const previousPhase=visit.phase;
      visit=advanceGazelleVisit(visit,delta,Math.random);
      if (visit.phase==="away") {
        if (images.length) clear();
        herd=[];
        return;
      }
      if (previousPhase!==visit.phase && visit.phase==="entering") {
        obstacles=gazelleTravelObstacles(snapshot.objects);
        herd=createGazelleHerd(obstacles);
      }
      const travelling=visit.phase==="entering" || visit.phase==="exiting";
      if (previousPhase!==visit.phase && travelling) {
        // Freeze the current formation, never jump back to its original spawn.
        herd=herd.map(a=>({...a,route:[],elapsed:0}));
        travelDistance=gazelleTravelDistance(herd,visit.phase==="entering");
        visit={...visit,duration:travelDistance*GAZELLE_TRAVEL_STEP_MS};
      }
      if (!reducedMotion && visit.phase==="visiting") herd=advanceGazelleHerd(herd,delta,obstacles);
      herd.forEach((a,i)=> {
        const scale=a.age==="young" ? .75 : 1;
        if (!images[i]?.sprite.scene) images[i]={
          sprite:scene.add.image(0,0,frame(a.age,"lower",0)).setOrigin(.5,.89),
          shadow:scene.add.ellipse(0,0,38*.95*scale,11*.95*scale,0x624728,.16)
        };
        const pose=gazelleGrazePose(a.elapsed,6500+i*350);
        const texture=reducedMotion ? frame(a.age,"lower",0) : travelling || a.route.length?frame(a.age,"walk",Math.floor((travelling ? visit.elapsed/180 : a.elapsed/120))%8):frame(a.age,pose.kind,pose.index);
        const travel=travelling && !reducedMotion ? gazelleTravelPose(a.position,travelDistance,visit.elapsed,visit.phase==="entering") : null;
        const alpha=travel?.alpha ?? gazelleVisitAlpha(visit);
        const p=isoPoint(travel?.cell ?? a.position), image=images[i]!;
        image.sprite.setAlpha(alpha).setTexture(texture).setDisplaySize(88*.95*scale,88*.95*scale).setPosition(p.x,p.y).setFlipX(travelling && !reducedMotion ? true : a.flip).setDepth(p.y+1);
        // Young artwork has more transparent padding below the hooves.
        // Lift its shadow to the feet without changing movement or depth sorting.
        image.shadow.setAlpha(alpha).setPosition(p.x,p.y-(a.age==="young" ? 5 : 0)).setDepth(p.y);
      });
    }
  };
};
