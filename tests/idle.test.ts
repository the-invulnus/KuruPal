import test from 'node:test';
import assert from 'node:assert/strict';
import {IdleSchedule,ambientActions} from '../src/idle';

test('ambient actions wait for a quiet interval and consume their due slot once',()=>{
 const s=new IdleSchedule();
 assert.equal(s.next(1e9,ambientActions,()=>0),null);
 s.reset(1000,()=>0);
 assert.equal(s.next(25999,ambientActions,()=>0),null);
 assert.equal(s.next(26000,ambientActions,()=>0),'idlePeek');
 assert.equal(s.next(1e9,ambientActions,()=>0),null);
});
test('ambient selection avoids the last action and suppresses nervous gestures by weight',()=>{
 const s=new IdleSchedule();s.reset(0,()=>0);
 assert.equal(s.next(30000,ambientActions,()=>0),'idlePeek');
 s.reset(30000,()=>0);
 assert.equal(s.next(60000,ambientActions,()=>0),'idleSmug');
 const choices=Array.from({length:80},(_,i)=>{const x=new IdleSchedule();x.reset(0,()=>0);return x.next(30000,ambientActions,()=>i/80);});
 assert.equal(choices.filter(a=>a==='idleNervous').length,10);
});
test('an interruption discards an overdue ambient action; only available clips are picked',()=>{
 const s=new IdleSchedule();s.reset(0,()=>0);s.suspend();
 assert.equal(s.next(1e9,ambientActions,()=>0),null);
 s.reset(100000,()=>0);
 assert.equal(s.next(124999,ambientActions,()=>0),null);
 assert.equal(s.next(125000,['idleNervous'],()=>0),'idleNervous');
});
