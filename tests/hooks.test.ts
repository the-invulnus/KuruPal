import test from 'node:test';
import assert from 'node:assert/strict';
import {ActionQueue,parseHook} from '../src/hooks';
test('hooks reject malformed, unknown and stale events',()=>{
 assert.equal(parseHook({action:'happy',createdAt:Date.now()})?.action,'happy');
 for(const event of [null,{}, {action:'shell',createdAt:Date.now()}, {action:'panic',createdAt:0}, {action:'happy',createdAt:Infinity}, {event:'unknown',action:'happy',createdAt:Date.now()}])assert.equal(parseHook(event),null);
});
test('every failure independently selects one reaction with matching copy',()=>{
 const event={event:'task_failed',createdAt:Date.now()};
 assert.deepEqual([0,.4,.9].map(r=>parseHook(event,()=>r)?.action),['sad','panic','tearful']);
 for(const r of [0,.4,.9])assert.ok(parseHook(event,()=>r)?.line);
 assert.equal(parseHook({event:'task_succeeded',createdAt:Date.now()},()=>0)?.action,'happy');
});
test('queue retains FIFO and repeated triggers including idle; reports overflow',()=>{
 const q=new ActionQueue();
 for(const action of ['happy','happy','idle','sad'] as const)assert.equal(q.push({action}),true);
 assert.deepEqual([q.next()?.action,q.next()?.action,q.next()?.action,q.next()?.action],['happy','happy','idle','sad']);
 assert.equal(q.next(),undefined);
 for(let i=0;i<64;i++)assert.equal(q.push({action:'panic',line:String(i)}),true);
 assert.equal(q.push({action:'sad'}),false);
 assert.equal(q.next()?.line,'0');assert.equal(q.length,63);
});
