import type {Quote} from './engine';
export type MarketQuote=Quote&{changePct:number;comparison:string};
const MINUTE=60000;
export const ALERT_RULES={firstDay:1,minute:0.5,fiveMinutes:1,cooldown:5*MINUTE};
type Sample={price:number;at:number};
type StockState={day:string;samples:Sample[];lastAlert:number|null};
export type AlertSnapshot=Record<string,StockState>;
const dayFormat=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'});
const dayAt=(at:number)=>dayFormat.format(new Date(at));
const reached=(pct:number,threshold:number)=>Math.abs(pct)+1e-9>=threshold;
// Thresholds are product notification defaults, not trading signals.
export class MarketAlerts{
 reason='';
 private states=new Map<string,StockState>();
 constructor(saved:unknown={},now=Date.now()){
  if(!saved||typeof saved!=='object'||Array.isArray(saved))return;
  for(const [symbol,value] of Object.entries(saved).slice(0,5)){
   const s=value as StockState;
   if(!/^\d{6}$/.test(symbol)||!s||s.day!==dayAt(now)||!Array.isArray(s.samples)||!s.samples.length||s.samples.length>10)continue;
   if(s.lastAlert!==null&&(!Number.isFinite(s.lastAlert)||s.lastAlert>now))continue;
   if(s.samples.some((p,i)=>!p||!Number.isFinite(p.price)||p.price<=0||!Number.isFinite(p.at)||p.at>now||dayAt(p.at)!==s.day||(i>0&&p.at<=s.samples[i-1].at)))continue;
   this.states.set(symbol,{day:s.day,samples:s.samples.map(p=>({...p})),lastAlert:s.lastAlert});
  }
 }
 retain(symbols:string[]){for(const symbol of this.states.keys())if(!symbols.includes(symbol))this.states.delete(symbol);}
 snapshot():AlertSnapshot{return Object.fromEntries([...this.states].map(([symbol,s])=>[symbol,{...s,samples:s.samples.map(p=>({...p}))}]));}
 next(q:Quote,now:number):MarketQuote|null{
  const day=dayAt(now),previous=this.states.get(q.symbol),sample={price:q.price,at:now};
  if(!previous||previous.day!==day){
   const alert=reached(q.pct,ALERT_RULES.firstDay);
   this.states.set(q.symbol,{day,samples:[sample],lastAlert:alert?now:null});
   this.reason=alert?'daily_threshold':'daily_below_threshold';
   return alert?{...q,changePct:q.pct,comparison:'较昨收'}:null;
  }
  const last=previous.samples.at(-1)!;
  if(now<=last.at){this.reason='non_increasing_time';return null;}
  // A missed poll, sleep or lunch break must not masquerade as a one-minute move.
  const continuous=now-last.at<=90_000;
  const history=continuous?previous.samples.filter(p=>now-p.at<=330_000):[];
  previous.samples=[...history,sample].slice(-10);
  if(!continuous){this.reason='gap_reset_baseline';return null;}
  if(previous.lastAlert!==null&&now-previous.lastAlert<ALERT_RULES.cooldown){this.reason='cooldown';return null;}
  let changePct=(q.price/last.price-1)*100,comparison='近1分钟';
  if(!reached(changePct,ALERT_RULES.minute)){
   const base=history.find(p=>now-p.at>=270_000);
   if(!base){this.reason='minute_below_threshold_waiting_five_minutes';return null;}
   changePct=(q.price/base.price-1)*100;comparison='近5分钟';
   if(!reached(changePct,ALERT_RULES.fiveMinutes)){this.reason='below_threshold';return null;}
  }
  this.reason=comparison==='近1分钟'?'minute_threshold':'five_minute_threshold';
  previous.lastAlert=now;
  return {...q,changePct,comparison};
 }
}
export function marketChangeText(q:MarketQuote):string{
 return `${q.comparison}${q.changePct>0?'涨':q.changePct<0?'跌':'持平'} ${q.changePct>0?'+':''}${q.changePct.toFixed(2)}%`;
}
