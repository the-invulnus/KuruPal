import test from 'node:test';
import assert from 'node:assert/strict';
import {MarketAlerts,marketChangeText} from '../src/market-alerts';
import {marketReaction} from '../src/market';
const start=Date.parse('2026-10-20T02:00:00Z'),minute=60000;
const quote=(price=100,pct=0,symbol='000001')=>({symbol,price,pct,fetchedAt:new Date(start).toISOString(),source:'test'});
test('daily first sample compares yesterday only above 1%, then recent direction wins',()=>{
 const a=new MarketAlerts();
 assert.equal(a.next(quote(100,0.99),start),null);
 const fall=a.next(quote(99.5,3),start+minute)!;
 assert.equal(fall.comparison,'近1分钟');assert.ok(Math.abs(fall.changePct+0.5)<1e-8);
 assert.equal(marketReaction(fall,()=>0).action,'sad');assert.equal(marketChangeText(fall),'近1分钟跌 -0.50%');assert.equal(fall.pct,3);
 const b=new MarketAlerts();assert.equal(b.next(quote(100,-1),start)?.comparison,'较昨收');
});
test('small one-minute moves accumulate into an approximately five-minute alert',()=>{
 const a=new MarketAlerts();
 for(let i=0;i<5;i++)assert.equal(a.next(quote(100+i*.2),start+i*minute),null);
 const result=a.next(quote(101),start+5*minute)!;
 assert.equal(result.comparison,'近5分钟');assert.ok(Math.abs(result.changePct-1)<1e-8);
});
test('cooldown is per stock and unchanged prices eventually age out of the rolling window',()=>{
 const a=new MarketAlerts();a.next(quote(),start);
 assert.ok(a.next(quote(100.5),start+minute));
 assert.equal(a.next(quote(102),start+2*minute),null);
 assert.ok(a.next(quote(100,2,'600519'),start+2*minute));
 for(let i=3;i<=7;i++)a.next(quote(102),start+i*minute);
 assert.equal(a.next(quote(102),start+8*minute),null);
});
test('cooldown permits a fresh opposing move after five minutes',()=>{
 const a=new MarketAlerts();a.next(quote(100,1),start);
 for(let i=1;i<5;i++)assert.equal(a.next(quote(100),start+i*minute),null);
 assert.ok(a.next(quote(99.5),start+5*minute)!.changePct<0);
});
test('failed polls, lunch and sleep reset short-term baseline instead of inventing one-minute moves',()=>{
 const a=new MarketAlerts();a.next(quote(),start);
 assert.equal(a.next(quote(105,5),start+2*minute),null);
 assert.equal(a.next(quote(106,6),start+92*minute),null);
 assert.ok(a.next(quote(107,7),start+93*minute));
});
test('new Shanghai day uses yesterday again; same-day restart preserves baseline and cooldown',()=>{
 const a=new MarketAlerts();a.next(quote(100,1),start);
 const b=new MarketAlerts(JSON.parse(JSON.stringify(a.snapshot())),start+minute);
 assert.equal(b.next(quote(101,2),start+minute),null);
 const nextDay=start+24*60*minute;
 assert.equal(b.next(quote(101,2),nextDay)?.comparison,'较昨收');
 const c=new MarketAlerts(a.snapshot(),nextDay);
 assert.equal(c.next(quote(101,-2),nextDay)?.comparison,'较昨收');
});
test('invalid persisted state is ignored and removing stocks clears their baseline',()=>{
 const a=new MarketAlerts({'000001':{day:'2026-10-20',samples:[{at:start,price:-1}],lastAlert:null}},start);
 assert.deepEqual(a.snapshot(),{});
 a.next(quote(100,1),start);a.retain([]);assert.deepEqual(a.snapshot(),{});
 assert.ok(a.next(quote(100,1),start+minute));
});
test('flat or subthreshold quotes never produce alerts and exact upward threshold works',()=>{
 const a=new MarketAlerts();a.next(quote(),start);
 assert.equal(a.next(quote(100.49),start+minute),null);
 const b=new MarketAlerts();b.next(quote(),start);
 assert.ok(b.next(quote(100.5),start+minute));
});
