import Phaser from "phaser";
import { deliveryPlan, deliveryPose, DONKEY_HITCH, type DeliveryCell } from "../../../game-data/zigguratDelivery";
import { DONKEY_STEP_MS } from "./isometricDonkey";
import { isoPoint, ISO_WIDTH, ISO_HEIGHT } from "./isometricProjection";
import { farmerTravelTexture } from "./farmerCarry";
import { prepareZigguratDonkey } from "./zigguratDonkeyPreview";
import { farmerObscured, type OcclusionSprite } from "./farmerOcclusion";
import type { Ziggurat } from "../../../schemas/ziggurat";

/** One shared visual donkey. Saved timestamps are presentation only. */
export const createZigguratDeliveryAnimation = (scene: Phaser.Scene,
  farmers: ReadonlyMap<number, Phaser.GameObjects.Image>, buildings: readonly { sprite: Phaser.GameObjects.Image; column:number;row:number;columns:number;rows:number }[]) => {
  prepareZigguratDonkey(scene);
  const empty=scene.add.image(0,0,"isometric-donkey-front-0").setOrigin(.5,120/128).setDisplaySize(76,76);
  const loaded=scene.add.image(0,0,"ziggurat-donkey-front-0").setOrigin(.5,120/128).setDisplaySize(76,76);
  const worker=scene.add.image(0,0,"farmer-idle").setOrigin(.5,120/128).setDisplaySize(64,64).setVisible(false);
  const shadows=[scene.add.ellipse(0,0,34,10,0x624728,.18),scene.add.ellipse(0,0,23,8,0x624728,.18)];
  const arrows=[0,1].map(()=>scene.add.text(0,0,"↓",{fontSize:"24px",color:"#ffd568",stroke:"#624728",strokeThickness:2}).setOrigin(.5,1).setDepth(10001).setVisible(false));
  const hitch=isoPoint(DONKEY_HITCH);
  const post=scene.add.graphics().setDepth(hitch.y-2);
  post.lineStyle(5,0x73502e).lineBetween(hitch.x-24,hitch.y-4,hitch.x-24,hitch.y-24)
    .lineStyle(2,0xb89259).lineBetween(hitch.x-28,hitch.y-19,hitch.x-20,hitch.y-19);
  const masks=new Map<string,ImageData>();
  const occlusion=(sprite:Phaser.GameObjects.Image):OcclusionSprite=>{
    let mask=masks.get(sprite.texture.key);
    if(!mask){const source=sprite.texture.getSourceImage() as HTMLImageElement|HTMLCanvasElement;
      const canvas=document.createElement("canvas");canvas.width=source.width;canvas.height=source.height;
      const ctx=canvas.getContext("2d",{willReadFrequently:true})!;ctx.drawImage(source,0,0);mask=ctx.getImageData(0,0,canvas.width,canvas.height);masks.set(sprite.texture.key,mask);}
    const pixels=mask,b=sprite.getBounds();
    return {left:b.x,top:b.y,width:b.width,height:b.height,depth:sprite.depth,opaqueAt:(u,v)=>{
      const x=Math.min(pixels.width-1,Math.floor((sprite.flipX?1-u:u)*pixels.width)),y=Math.min(pixels.height-1,Math.floor(v*pixels.height));
      return (pixels.data[(y*pixels.width+x)*4+3]??0)>64;
    }};
  };
  const depth=(p:DeliveryCell)=>{
    let result=isoPoint(p).y+1;
    for(const b of buildings){
      // Only adjust nearby footprint edges; remote buildings cannot pull actors forward.
      if(p.column<b.column-1 || p.column>b.column+b.columns+1 || p.row<b.row-1 || p.row>b.row+b.rows+1) continue;
      const front=p.column>=b.column+b.columns-.5 || p.row>=b.row+b.rows-.5;
      result=front?Math.max(result,b.sprite.depth+1):Math.min(result,b.sprite.depth-1);
    }
    return result;
  };
  let deliveries:Ziggurat["deliveries"]=[],clockOffset=0,previewSlot:number|null=null,previewElapsed=0;
  const plans=new Map<number,ReturnType<typeof deliveryPlan>>();
  const planFor=(slot:number)=>{let plan=plans.get(slot);if(!plan){plan=deliveryPlan(slot);plans.set(slot,plan);}return plan;};
  const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const update=(delta:number)=>{
    const now=Date.now()+clockOffset;
    const job=deliveries.find(d=>Date.parse(d.startsAt)<=now && Date.parse(d.completesAt)>now);
    const slot=previewSlot??job?.slot;
    for(const [s,farmer] of farmers) farmer.setVisible(s!==slot);
    if(slot===undefined){worker.setVisible(false);loaded.setVisible(false);empty.setVisible(true).setAlpha(1).setTexture("isometric-donkey-front-0").setDisplaySize(76,76).setPosition(hitch.x,hitch.y+8).setDepth(depth(DONKEY_HITCH));
      shadows[0]!.setPosition(hitch.x,hitch.y).setDepth(hitch.y);shadows[1]!.setVisible(false);arrows.forEach(a=>a.setVisible(false));return;}
    const plan=planFor(slot);
    if(previewSlot!==null) previewElapsed=(previewElapsed+Math.min(delta,100))%(plan.duration+1200);
    const elapsed=previewSlot!==null?Math.min(previewElapsed,plan.duration):now-Date.parse(job!.startsAt);
    const pose=deliveryPose(plan,elapsed),fp=isoPoint(pose.farmer.position),dp=isoPoint(pose.donkey.position);
    const df=isoPoint(pose.donkey.from),dt=isoPoint(pose.donkey.to),ff=isoPoint(pose.farmer.from),ft=isoPoint(pose.farmer.to);
    const direction=dt.y<df.y?"back":"front";
    const frame=pose.donkey.moving&&!reduced?Math.floor(elapsed/(DONKEY_STEP_MS/4))%4:0;
    for(const [actor,prefix,alpha] of [[empty,"isometric",1-pose.load],[loaded,"ziggurat",pose.load]] as const)
      actor.setVisible(alpha>0).setAlpha(alpha).setTexture(`${prefix}-donkey-${direction}-${frame}`).setDisplaySize(76,76)
        .setFlipX(dt.x>df.x).setPosition(dp.x,dp.y+8).setDepth(depth(pose.donkey.position));
    // Stand beside the donkey while handling bags; a small reaching lean keeps feet planted.
    const beside=!pose.farmer.moving && !pose.donkey.moving;
    worker.setVisible(true).setTexture(farmerTravelTexture(pose.farmer.travelledTiles*Math.hypot(ISO_WIDTH/2,ISO_HEIGHT/2),0,pose.farmer.moving&&!reduced)).setDisplaySize(64,64)
      .setFlipX(pose.working?true:ft.x<ff.x).setPosition(fp.x+(beside?27:0),fp.y)
      .setAngle(pose.working&&!reduced?Math.sin(elapsed/300)*3:0).setDepth(depth(pose.farmer.position)+1);
    shadows[0]!.setPosition(dp.x,dp.y).setDepth(dp.y);
    shadows[1]!.setVisible(true).setPosition(worker.x,fp.y).setDepth(fp.y);
    const obstacles=buildings.map(b=>occlusion(b.sprite));
    [pose.load>.5?loaded:empty,worker].forEach((actor,i)=>arrows[i]!.setVisible(farmerObscured(occlusion(actor),obstacles)).setPosition(actor.x,actor.y-70));
  };
  update(0);
  return {update,receive:(data:Ziggurat)=>{deliveries=data.deliveries;clockOffset=Date.parse(data.serverTime)-Date.now();},
    preview:(slot:number|null)=>{previewSlot=slot;previewElapsed=0;update(0);},
    destroy:()=>{for(const farmer of farmers.values())farmer.setVisible(true);[empty,loaded,worker,post,...shadows,...arrows].forEach(a=>a.destroy());}};
};
