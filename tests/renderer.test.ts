import test from 'node:test';
import assert from 'node:assert/strict';
import {Renderer,type Media} from '../src/media';
import {ActionQueue} from '../src/hooks';
test('first frame is painted before swap; FIFO waits for boundaries; late loads cannot overwrite',()=>{
 let pending:FrameRequestCallback|undefined;let ends=0,loops=0,ready=0;
 const images:{onload?:()=>void,onerror?:()=>void,width:number,height:number}[]=[];
 const saved={document:globalThis.document,Image:globalThis.Image,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame,window:globalThis.window};
 Object.assign(globalThis,{
  document:{createElement:()=>{const canvas={width:0,height:0,painted:false,getContext:()=>({clearRect(){},drawImage(){canvas.painted=true;}})};return canvas;}},
  Image:class{width=20;height=10;onload?:()=>void;constructor(){images.push(this);}},
  requestAnimationFrame:(callback:FrameRequestCallback)=>{pending=callback;return 1;},cancelAnimationFrame:()=>{pending=undefined;},window:{clearTimeout(){}}
 });
 try{
  let visible:unknown='previous frame';
  const host={replaceChildren(element:{painted:boolean}){assert.ok(element?.painted,'never expose an empty canvas');visible=element;}} as unknown as HTMLElement;
  const renderer=new Renderer(host,()=>{});
  const clip={type:'sprite' as const,src:'test.png',frameWidth:10,frameHeight:10,columns:2,frames:2,fps:2,loop:false};
  const media:Media={pack:{name:'test',actions:{idle:{...clip,loop:true},happy:clip,sad:clip}},urls:{'test.png':'test.png'}};
  renderer.play('happy',media,()=>ends++,undefined,()=>ready++);
  assert.equal(visible,'previous frame');assert.equal(ready,0);
  images.at(-1)!.onload!();assert.equal(ready,1);const first=visible;
  const q=new ActionQueue();q.push({action:'sad'});assert.equal(visible,first);assert.equal(ends,0);
  const endCallback=pending!;endCallback(performance.now()+1100);endCallback(performance.now()+1200);assert.equal(ends,1);
  renderer.play(q.next()!.action,media);assert.equal(visible,first);
  images.at(-1)!.onload!();assert.notEqual(visible,first);
  renderer.play('idle',media,undefined,()=>loops++);images.at(-1)!.onload!();pending!(performance.now()+1100);assert.equal(loops,1);
  const old=visible;renderer.play('happy',media);const late=images.at(-1)!.onload!;
  renderer.play('sad',media);late();assert.equal(visible,old);
  images.at(-1)!.onerror!();assert.equal(visible,old,'decode error preserves the prior frame');
 }finally{Object.assign(globalThis,saved);}
});
