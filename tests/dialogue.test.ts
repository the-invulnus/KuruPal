import test from 'node:test';
import assert from 'node:assert/strict';
import {IdleDialogue} from '../src/dialogue';
test('idle dialogue waits 30–60 seconds, avoids repeats, and activity resets it',()=>{
 const d=new IdleDialogue();d.reset(1000,()=>0);
 assert.equal(d.next(30999),null);
 const first=d.next(31000,()=>0);assert.ok(first);
 assert.equal(d.next(31001),null);
 const second=d.next(61000,()=>0);assert.ok(second);assert.notEqual(second,first);
 d.reset(200000,()=>.999);assert.equal(d.next(259000),null);assert.ok(d.next(260000));
});
