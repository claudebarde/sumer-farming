// Draw just the moving boats as a transparent foreground pass over the approved river.
// Usage: node boats.cjs <1920x1080 reference frame> <output directory> [frame ...]
const sharp = require('sharp');
const fs = require('node:fs/promises');
const path = require('node:path');
const [reference, output, ...requested] = process.argv.slice(2);
const FPS = 30, PERIOD = 96, FRAMES = PERIOD * FPS;
const crop = {left: 1024, top: 476, width: 896, height: 104};
const tau = Math.PI * 2;
const clamp = x => Math.max(0, Math.min(1, x));
const mod = x => (x % 1 + 1) % 1;
const boats = [
  { start: 1190, scale: .3828, depth: 0, cycles: 23, phase: .32, skin: '#ad7048', cloth: '#cfba8d' },
  { start: 1468, scale: .5126, depth: 1, cycles: 25, phase: .76, skin: '#bb8151', cloth: '#e3c997' },
];

// The hull floats to the right continuously. It resets after clearing the right
// frame edge, with the new position entirely hidden by the mudbrick farmhouse.
function pose(b, f) {
  const t=(f % FRAMES)/FPS, from=1060, distance=918;
  const rate=distance/PERIOD, cycle=PERIOD/b.cycles;
  const phase=mod(t/cycle+b.phase);
  const surge = p => -.34*Math.sin(tau*p);
  const x=from+distance*mod((b.start-from)/distance+t/PERIOD)
    +surge(phase)-surge(b.phase);
  const y=526+(x-1060)*.030+b.depth*14+.18*Math.sin(tau*phase+.4);
  const planted=.56;
  const stroke=(p)=> (rate*cycle*p + surge(p)-surge(0))/b.scale;
  let tip=3-stroke(Math.min(phase,planted)), lift=0;
  if(phase>planted) {
    const v=(phase-planted)/(1-planted);
    // Hermite recovery joins the plant and release at the same boat-relative speed.
    const speed=-(rate*cycle-.34*tau)*(1-planted)/b.scale;
    tip += stroke(planted)*v*v*(3-2*v)+speed*v*(1-v)*(1-2*v);
    lift=8*Math.sin(Math.PI*v)**2;
  }
  return {x,y,phase,tip,lift};
}
const line=(a,b,color,width)=>'<path d="M'+a[0]+' '+a[1]+' L'+b[0]+' '+b[1]+'" fill="none" stroke="'+color+'" stroke-width="'+width+'" stroke-linecap="round"/>';
function drawing(b, f) {
  const p=pose(b,f), scale=b.scale;
  const left=Math.floor(p.x-48), top=Math.floor(p.y-32);
  const cx=p.x-left, cy=p.y-top;
  const sway=Math.sin(tau*(p.phase+.10));
  const shoulder=[-28+2.5*sway,-27+.65*sway], hip=[-30,-13];
  const end=[-28+p.tip,1-p.lift], mid=[shoulder[0]+5,-22];
  const dx=mid[0]-end[0], dy=mid[1]-end[1], length=Math.hypot(dx,dy);
  const up=[dx/length,dy/length];
  const grip=d=>[mid[0]+d*up[0],mid[1]+d*up[1]];
  const arm=(a,z,reach)=>'<path d="M'+a.join(' ')+' Q'+(a[0]+reach)+' '+(a[1]+8)+' '+z.join(' ')+'" fill="none" stroke="'+b.skin+'" stroke-width="3.6" stroke-linecap="round"/>';
  const [sx,sy]=shoulder;
  let art='<g transform="translate('+cx+' '+cy+') scale('+scale+')">';
  // Low water contact and two tapering disturbed ripples.
  art+='<path d="M-79 1 Q-49 4 34 1 Q8 7 -39 5Z" fill="#377d79" opacity=".45"/><path d="M-76 2 Q-64 3 -50 2 M-65 5 Q-51 5 -45 4" fill="none" stroke="#add2c2" stroke-width="1.2" opacity=".56"/>';
  art+='<path d="M-60 -15 Q-51 -6 -28 -7 Q17 -6 43 -10 Q54 -12 59 -22 Q57 -9 43 -5 Q-12 3 -47 -4 Q-56 -6 -60 -15Z" fill="#392013"/>';
  // A low load amidships, confined within the gunwales.
  art+='<path d="M-7 -7 Q-10 -14 -4 -16 Q2 -19 9 -14 L13 -7Z" fill="#aa8a57"/><path d="M7 -7 Q6 -14 15 -15 Q24 -16 28 -10 L28 -7Z" fill="#c29d64"/><path d="M-4 -15 L-2 -8 M18 -14 L19 -8" stroke="#816b48" stroke-width="1.5"/>';
  art+=line(hip,[-34,-6],b.skin,3.5)+line(hip,[-24,-6],b.skin,3.5);
  art+='<path d="M'+(sx-2)+' '+sy+' Q'+(sx+2)+' '+(sy-2)+' '+(sx+4)+' '+(sy+2)+' L-26 -13 L-33 -13Z" fill="'+b.skin+'"/>';
  art+='<path d="M-33 -16 L-26 -15 L-24 -9 L-34 -9Z" fill="'+b.cloth+'"/><path d="M-32 -16 L-26 -15" stroke="#79664c" stroke-width="1.4"/>';
  art+='<ellipse cx="'+(sx+1)+'" cy="'+(sy-4)+'" rx="3.1" ry="4.1" fill="'+b.skin+'"/><path d="M'+(sx-2)+' '+(sy-3)+' q-1 -7 5 -5 l1.3 2 q-3 -1 -3.3 2 l-1 3Z" fill="#4c3c2d"/>';
  art+=arm([sx+2,sy+2],grip(-5),4);
  art+=line(end,grip(19),'#57402b',2.15)+line([end[0]+.5,end[1]-.3],grip(18),'#9d805c',.75);
  art+=arm(shoulder,grip(4),1);
  // Rising ends and a dark wet lower hull, with one thin sunlit gunwale.
  art+='<path d="M-60 -15 C-55 -8 -46 -7 -31 -6 Q9 -3 40 -9 Q54 -12 59 -22 Q57 -10 48 -5 Q34 1 -6 1 Q-42 1 -51 -4 Q-58 -7 -60 -15Z" fill="#492918" stroke="#331b10" stroke-width="1.4"/><path d="M-55 -10 Q-43 -4 -24 -5 Q19 -3 44 -10 Q54 -13 58 -20" fill="none" stroke="#8b5b38" stroke-width="1.8"/><path d="M-50 -4 Q-14 3 28 -2 Q46 -3 53 -9" fill="none" stroke="#301b12" stroke-width="1.6"/>';
  for(const x of [-47,-30,-12,8,29,46]){
    const y=-5-.0022*x*x;
    art+=line([x,y+1],[x+1.5,y+4.5],'#593720',1);
  }
  return {left:left-crop.left,top:top-crop.top,svg:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="46">'+art+'</g></svg>')};
}
async function run(){
 await fs.mkdir(output,{recursive:true});
 const bg=await sharp(reference).extract(crop).removeAlpha().raw().toBuffer();
 const mask=Buffer.alloc(crop.width*crop.height,255);
 // Only the farmhouse and the date palm stand in front of these two routes.
 // Key their painted contours, keeping the far shore behind the figures.
 for(let y=0;y<crop.height;y++)for(let x=0;x<crop.width;x++){
   const xx=x+crop.left, yy=y+crop.top, i=y*crop.width+x;
   if(xx<1151 || (xx>1247 && xx<1376 && yy<579)){
     const [r,g,b]=bg.subarray(3*i,3*i+3);
     const water=clamp((b-r+8)/42)*clamp((b-g+49)/30);
     mask[i]=Math.round(255*water);
   }
 }
 const draw=async f=>{
   const rgba=Buffer.alloc(crop.width*crop.height*4);
   for(const boat of boats){
     const obj=drawing(boat,f);
     const pix=await sharp(obj.svg,{density:216}).resize(96,46).ensureAlpha().raw().toBuffer();
     for(let y=0;y<46;y++)for(let x=0;x<96;x++){
       const u=obj.left+x,v=obj.top+y;
       if(u<0||u>=crop.width||v<0||v>=crop.height)continue;
       const k=(y*96+x)*4,i=v*crop.width+u,a=pix[k+3];
       if(!a||!mask[i])continue;
       rgba.set(pix.subarray(k,k+3),4*i);
       rgba[4*i+3]=Math.round(a*mask[i]/255);
     }
   }
   await sharp(rgba,{raw:{width:crop.width,height:crop.height,channels:4}})
     .png({compressionLevel:1}).toFile(path.join(output,'f-'+String(f+1).padStart(4,'0')+'.png'));
 };
 const frames=requested.length?requested.map(Number):Array.from({length:FRAMES+1},(_,i)=>i);
 for(let i=0;i<frames.length;i+=6)await Promise.all(frames.slice(i,i+6).map(draw));
}
run().catch(e=>{console.error(e);process.exitCode=1});
