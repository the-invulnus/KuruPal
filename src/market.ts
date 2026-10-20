import type {Action,Quote} from './engine';
import type {Reaction} from './hooks';
import {MarketAlerts,marketChangeText,type MarketQuote,type AlertSnapshot} from './market-alerts';
export const MARKET_INTERVAL=60000;
export function parseWatchlist(value:unknown):string[]{
 if(!Array.isArray(value)||value.length>5||value.some(s=>typeof s!=='string'||!/^\d{6}$/.test(s)))throw Error('请输入六位A股代码，最多关注5只股票。');
 return [...new Set(value)];
}
export type MarketResult={quotes:Quote[];errors:{symbol:string;error:string}[]};
export function marketReaction(q:MarketQuote,random=Math.random):Reaction{
 const big=q.comparison==='较昨收'?3:1.5;
 const candidates:Action[]=q.changePct>=big?['celebrate','joyfulLaugh']:q.changePct>0?['happy','idleSmug']:q.changePct<=-big?['panic','tearful']:q.changePct<0?['sad','idleNervous']:['idlePeek'];
 const action=candidates[Math.floor(Math.min(Math.max(random(),0),1-Number.EPSILON)*candidates.length)];
 return {action,market:{...q},line:`${q.symbol} ¥${q.price.toFixed(2)}\n${marketChangeText(q)}`};
}
// Injected transport and clock make cadence, in-flight edits and failures testable.
export class MarketMonitor{
 private symbols:string[]=[];
 private alerts:MarketAlerts;
 private generation=0;
 private busy=false;
 private nextAt=0;
 constructor(private fetch:(symbols:string[])=>Promise<MarketResult>,private emit:(r:Reaction)=>void,private status:(s:string)=>void,private now=Date.now,saved:unknown={},private persist:(state:AlertSnapshot)=>void=()=>{},private diagnostic:(value:unknown)=>void=()=>{}){this.alerts=new MarketAlerts(saved,now());}
 setSymbols(symbols:string[]){
  this.symbols=parseWatchlist(symbols);this.generation++;
  this.alerts.retain(this.symbols);this.save();
  this.status(this.symbols.length?'已保存，盘中每分钟采集，达到阈值才提醒。':'尚未关注股票，不请求行情。');
 }
 async tick(){
  const now=this.now();
  if(this.busy||!this.symbols.length||now<this.nextAt)return;
  this.busy=true;this.nextAt=now+MARKET_INTERVAL;
  const generation=this.generation,symbols=[...this.symbols];
  try{
   const result=await this.fetch(symbols);
   if(generation!==this.generation){this.diagnostic({event:'discard_changed_watchlist'});return;}
   const received=new Set<string>();
   for(const q of result.quotes){
    if(!symbols.includes(q.symbol)||received.has(q.symbol)||!Number.isFinite(q.price)||q.price<=0||!Number.isFinite(q.pct)||!Number.isFinite(Date.parse(q.fetchedAt)))continue;
    received.add(q.symbol);
    const alert=this.alerts.next(q,this.now());
    this.diagnostic({event:'quote_evaluated',symbol:q.symbol,price:q.price,dailyPct:q.pct,reason:this.alerts.reason,changePct:alert?.changePct,comparison:alert?.comparison});
    if(alert)this.emit(marketReaction(alert));
   }
   this.save();
   if(received.size){
    const time=new Date(this.now()).toLocaleTimeString();
    this.status(`${time} 已获取${received.size}只行情；小波动保持安静。`);
   }
  }catch{
   this.diagnostic({event:'fetch_failed_silent'});
   // Keep the last valid snapshot and retry silently on the next minute.
  }finally{this.busy=false;}
 }
 private save(){try{this.persist(this.alerts.snapshot());}catch{/* Storage failure must not interrupt sampling. */}}
}
