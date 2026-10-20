import manifest from '../public-app/kurumi/manifest.json';
import {actions,type Action} from './engine';
export type Clip={type:'sprite'|'video'|'image';src:string;frameWidth?:number;frameHeight?:number;columns?:number;frames?:number;fps?:number;loop?:boolean;durationMs?:number};
export type Pack={name:string;actions:Partial<Record<Action,Clip>>};
export type Media={pack:Pack;urls:Record<string,string>};
export function builtinPack():Media {
  const base='./kurumi/';
  const pack=validatePack(manifest);
  return {pack,urls:Object.fromEntries(Object.values(pack.actions).map(c=>[c.src,base+c.src]))};
}
export function validatePack(raw:unknown):Pack {
  const p=raw as Pack;
  if(!p || typeof p.name!=='string'||!p.actions||!p.actions.idle) throw Error('素材包需要 name、actions 和 idle 动作');
  for(const [key,c] of Object.entries(p.actions)) {
    if(!actions.includes(key as Action)||!c||!['sprite','video','image'].includes(c.type)||typeof c.src!=='string'||!c.src.match(/^[^/\\]+\.(png|webp|webm|mp4)$/i)) throw Error('动作或文件名不合法，请使用同目录 PNG / WebP / WebM / MP4');
    if(c.type==='video'&&!/\.(webm|mp4)$/i.test(c.src)||c.type!=='video'&&!/\.(png|webp)$/i.test(c.src)) throw Error('素材类型与文件扩展名不匹配');
    if(c.type==='sprite' && (![c.frameWidth,c.frameHeight,c.columns,c.frames,c.fps].every(x=>Number.isInteger(x)&&Number(x)>0)||c.frames!>600||c.fps!>60)) throw Error('精灵图参数需要正整数，帧数 ≤600，帧率 ≤60');
    if(c.durationMs!==undefined && (!Number.isFinite(c.durationMs)||c.durationMs<500||c.durationMs>30000)) throw Error('动作时长应为 500～30000ms');
  }
  return p;
}
function db():Promise<IDBDatabase> {return new Promise((resolve,reject)=>{const r=indexedDB.open('market-pet-assets',1);r.onupgradeneeded=()=>r.result.createObjectStore('packs');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function savePack(files:File[]) {
  const manifest=files.find(f=>f.name==='manifest.json');if(!manifest) throw Error('请同时选择 manifest.json 和素材文件');
  const pack=validatePack(JSON.parse(await manifest.text()));
  for(const c of Object.values(pack.actions)) if(!files.some(f=>f.name===c.src)) throw Error(`缺少素材：${c.src}`);
  if(files.reduce((n,f)=>n+f.size,0)>100*1024*1024) throw Error('素材包不能超过 100MB');
  const database=await db();
  await new Promise<void>((resolve,reject)=>{const t=database.transaction('packs','readwrite');t.objectStore('packs').put({pack,files},'active');t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);});database.close();
}
export async function loadPack():Promise<{pack:Pack;urls:Record<string,string>}|null> {
  const database=await db();
  const saved=await new Promise<any>((resolve,reject)=>{const r=database.transaction('packs').objectStore('packs').get('active');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});database.close();
  if(!saved)return null;
  return {pack:validatePack(saved.pack),urls:Object.fromEntries(saved.files.map((f:File)=>[f.name,URL.createObjectURL(f)]))};
}
export class Renderer {
  private cancel=()=>{};
  constructor(private host:HTMLElement,private error:(message:string)=>void){}
  play(action:Action,media:Media|null,onEnd?:()=>void,onLoop?:()=>void,onReady?:()=>void) {
    // Stop the old animation but retain its last painted frame until commit.
    this.cancel();
    const clip=media?.pack.actions[action]??media?.pack.actions.idle;
    if(!clip||!media){this.error('缺少动作素材。');onEnd?.();return;}
    let disposed=false,raf=0,timer=0,committed=false,ended=false;
    const finish=()=>{if(!disposed&&!ended){ended=true;onEnd?.();}};
    const commit=(element:HTMLElement)=>{
      if(disposed||committed)return;
      committed=true;this.host.replaceChildren(element);onReady?.();
    };
    const fail=()=>{
      if(disposed)return;
      this.error('素材无法播放，已保留上一帧。');
      cancelAnimationFrame(raf);window.clearTimeout(timer);finish();disposed=true;
    };
    if(clip.type==='video') {
      const v=document.createElement('video');
      v.muted=true;v.playsInline=true;v.preload='auto';
      v.loop=clip.loop??['idle','sleep','offline'].includes(action);
      let lastTime=0;
      v.ontimeupdate=()=>{const t=v.currentTime;if(!disposed&&v.loop&&t<lastTime)onLoop?.();lastTime=t;};
      v.onerror=fail;v.onended=finish;
      v.onloadeddata=()=>{if(disposed)return;commit(v);v.play().catch(fail);};
      this.cancel=()=>{
        disposed=true;v.onloadeddata=null;v.onended=null;v.ontimeupdate=null;v.onerror=null;v.pause();
        // Retain src while this is still the visible frozen frame.
      };
      v.src=media.urls[clip.src];v.load();
    } else if(clip.type==='image') {
      const img=new Image();img.alt='久留美';img.onerror=fail;
      img.onload=()=>{if(disposed)return;commit(img);if(clip.loop===false)timer=window.setTimeout(finish,clip.durationMs??4500);};
      this.cancel=()=>{disposed=true;img.onload=null;img.onerror=null;window.clearTimeout(timer);};
      img.src=media.urls[clip.src];
    } else {
      const canvas=document.createElement('canvas'),img=new Image();
      canvas.width=clip.frameWidth!;canvas.height=clip.frameHeight!;
      const ctx=canvas.getContext('2d');
      if(!ctx){fail();return;}
      const paint=(frame:number)=>{
        ctx.clearRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(img,(frame%clip.columns!)*canvas.width,Math.floor(frame/clip.columns!)*canvas.height,canvas.width,canvas.height,0,0,canvas.width,canvas.height);
      };
      img.onerror=fail;img.onload=()=>{
        if(disposed)return;
        if(img.width<clip.columns!*canvas.width||img.height<Math.ceil(clip.frames!/clip.columns!)*canvas.height){fail();return;}
        // Decode and paint off-DOM, then swap atomically. No empty canvas is exposed.
        paint(0);commit(canvas);
        const start=performance.now();let lastCycle=0;
        const draw=(t:number)=>{
          if(disposed||ended)return;
          const elapsed=Math.floor((t-start)*clip.fps!/1000);
          if(clip.loop===false&&elapsed>=clip.frames!){paint(clip.frames!-1);finish();return;}
          const cycle=Math.floor(elapsed/clip.frames!);
          if(cycle>lastCycle){lastCycle=cycle;onLoop?.();if(disposed)return;}
          paint(elapsed%clip.frames!);
          raf=requestAnimationFrame(draw);
        };
        raf=requestAnimationFrame(draw);
      };
      this.cancel=()=>{disposed=true;cancelAnimationFrame(raf);img.onload=null;img.onerror=null;};
      img.src=media.urls[clip.src];
    }
  }
}
