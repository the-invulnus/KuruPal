import test from 'node:test';import assert from 'node:assert/strict';
import {mood,Reactions,sessionOpen} from '../src/engine';import {validatePack,builtinPack} from '../src/media';
test('thresholds use percentage points, invalid quotes never celebrate',()=>{assert.equal(mood(3),'celebrate');assert.equal(mood(-3),'panic');assert.equal(mood(.2),'idle');assert.equal(mood(NaN),'offline');});
test('cooldown and hysteresis prevent repetitive or oscillating reactions',()=>{const r=new Reactions();assert.equal(r.next(3,0),'celebrate');assert.equal(r.next(-4,1000),null);assert.equal(r.next(2.9,61000),null);assert.equal(r.next(-4,62000),'panic');assert.equal(r.next(-4,130000),null);});
test('Shanghai sessions exclude weekend, lunch and after close independent of host timezone',()=>{assert.equal(sessionOpen(new Date('2026-10-19T02:00:00Z')),true);assert.equal(sessionOpen(new Date('2026-10-19T04:00:00Z')),false);assert.equal(sessionOpen(new Date('2026-10-18T02:00:00Z')),false);assert.equal(sessionOpen(new Date('2026-10-19T08:00:00Z')),false);});
test('asset manifests reject path escapes and malformed sprites',()=>{assert.throws(()=>validatePack({name:'x',actions:{idle:{type:'video',src:'../bad.webm'}}}));assert.throws(()=>validatePack({name:'x',actions:{idle:{type:'sprite',src:'a.png',fps:0}}}));assert.equal(validatePack({name:'x',actions:{idle:{type:'video',src:'idle.webm'}}}).name,'x');});

test('Kurumi pack contains event clips and ambient clips are single-shot while base idle loops',()=>{
 const {pack,urls}=builtinPack();validatePack(pack);
 assert.equal(pack.actions.idle?.type,'sprite');assert.equal(pack.actions.idle?.loop,true);
 for(const action of ['panic','happy','celebrate','joyfulLaugh','pray','sad','tearful','idlePeek','idleSmug','idleNervous'] as const){
  assert.equal(pack.actions[action]?.type,'sprite');
  assert.equal(pack.actions[action]?.loop,false);
  assert.ok(urls[pack.actions[action]!.src].startsWith('./kurumi/'));
 }
 assert.throws(()=>validatePack({name:'bad',actions:{idle:{type:'image',src:'idle.mp4'}}}));
 assert.throws(()=>validatePack({name:'bad',actions:{idle:{type:'video',src:'idle.png'}}}));
});
