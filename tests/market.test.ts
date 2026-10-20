import test from 'node:test';
import assert from 'node:assert/strict';
import {MarketMonitor,marketReaction,parseWatchlist,type MarketResult} from '../src/market';
import type {Reaction} from '../src/hooks';
const quote=(symbol='000001',price=10,pct=1)=>({symbol,price,pct,fetchedAt:new Date().toISOString(),source:'test'});
test('watchlist accepts removal and deduplicates; invalid or excessive codes are rejected',()=>{
 assert.deepEqual(parseWatchlist([]),[]);assert.deepEqual(parseWatchlist(['000001','000001']),['000001']);
 for(const value of [['abc'],['12345'],['000001;sh'],['1','2','3','4','5','6'],null])assert.throws(()=>parseWatchlist(value));
});
const daily=(q:ReturnType<typeof quote>)=>({...q,changePct:q.pct,comparison:'较昨收'});
test('positive, negative and flat daily changes choose matching actions and explicit copy',()=>{
 assert.equal(marketReaction(daily(quote('000001',10,4)),()=>.99).action,'joyfulLaugh');
 assert.equal(marketReaction(daily(quote('000001',10,-4)),()=>.99).action,'tearful');
 assert.equal(marketReaction(daily(quote('000001',10,0))).action,'idlePeek');
 assert.match(marketReaction(daily(quote('000001',10,-1))).line!,/较昨收跌 -1.00%/);
 assert.equal(marketReaction(daily(quote('000001',10,1))).market?.pct,1);
});
test('polling is once per minute, unchanged snapshots do not repeat, no symbols means no calls',async()=>{
 let now=0,calls=0,price=10;const reactions:Reaction[]=[];
 const monitor=new MarketMonitor(async()=>{calls++;return {quotes:[quote('000001',price)],errors:[]};},r=>reactions.push(r),()=>{},()=>now);
 await monitor.tick();assert.equal(calls,0);
 monitor.setSymbols(['000001']);await monitor.tick();assert.equal(calls,1);assert.equal(reactions.length,1);
 now=59999;await monitor.tick();assert.equal(calls,1);
 now=60000;await monitor.tick();assert.equal(calls,2);assert.equal(reactions.length,1);
 price=11;now=120000;await monitor.tick();assert.equal(reactions.length,1);
 monitor.setSymbols([]);now=180000;await monitor.tick();assert.equal(calls,3);
});
test('watchlist changes discard in-flight responses and do not overlap requests',async()=>{
 let resolve!:(r:MarketResult)=>void,calls=0,now=0;const reactions:Reaction[]=[];
 const monitor=new MarketMonitor(()=>{calls++;return new Promise(r=>resolve=r);},r=>reactions.push(r),()=>{},()=>now);
 monitor.setSymbols(['000001']);const first=monitor.tick();await monitor.tick();assert.equal(calls,1);
 monitor.setSymbols(['600519']);resolve({quotes:[quote()],errors:[]});await first;assert.equal(reactions.length,0);
 now=60000;const next=monitor.tick();resolve({quotes:[quote('600519')],errors:[]});await next;assert.equal(reactions[0].market?.symbol,'600519');
});
test('partial failures only emit valid quotes and remain silent on unchanged retries',async()=>{
 let now=0;const reactions:Reaction[]=[];const statuses:string[]=[];
 const monitor=new MarketMonitor(async()=>({quotes:[quote(),quote('600519',NaN)],errors:[{symbol:'600519',error:'unavailable'}]}),r=>reactions.push(r),s=>statuses.push(s),()=>now);
 monitor.setSymbols(['000001','600519']);await monitor.tick();assert.equal(reactions.length,1);assert.equal(reactions[0].market?.symbol,'000001');
 now=60000;await monitor.tick();now=300000;await monitor.tick();assert.equal(reactions.length,1);
 assert.ok(statuses.every(s=>!s.includes('不可用')&&!s.includes('失败')));
});
test('transport failure is silent, retries next minute and retains last valid snapshot',async()=>{
 let now=0,calls=0;const reactions:Reaction[]=[];const statuses:string[]=[];
 const monitor=new MarketMonitor(async()=>{if(++calls===1||calls===3)throw Error('network');return {quotes:[quote()],errors:[]};},r=>reactions.push(r),s=>statuses.push(s),()=>now);
 monitor.setSymbols(['000001']);const savedStatus=[...statuses];await monitor.tick();assert.equal(reactions.length,0);assert.deepEqual(statuses,savedStatus);
 now=60000;await monitor.tick();assert.equal(reactions[0].market?.symbol,'000001');
 now=120000;await monitor.tick();now=180000;await monitor.tick();assert.equal(calls,4);assert.equal(reactions.length,1);
});
