import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MenuOperations} from '../src/menu-operations';

test('menu updates wait for popup dismissal, duplicate right clicks do not reopen it',async()=>{
  const operations=new MenuOperations();
  let close!:()=>void;
  const dismissed=new Promise<void>(resolve=>{close=resolve;});
  const calls:string[]=[];
  const popup=operations.popup(async()=>{calls.push('open');await dismissed;calls.push('close');});
  await Promise.resolve();
  const update=operations.run(async()=>{calls.push('checked');});
  await operations.popup(async()=>{calls.push('duplicate');});
  await Promise.resolve();
  assert.deepEqual(calls,['open']);
  close();await popup;await update;
  assert.deepEqual(calls,['open','close','checked']);
  await operations.popup(async()=>{calls.push('reopen');});
  assert.equal(calls.at(-1),'reopen');
});

test('failed popup releases the queue and permits recovery',async()=>{
 const operations=new MenuOperations();
 await assert.rejects(operations.popup(async()=>{throw Error('native failure');}));
 assert.equal(await operations.run(async()=>true),true);
 let opened=false;
 await operations.popup(async()=>{opened=true;});
 assert.equal(opened,true);
});
