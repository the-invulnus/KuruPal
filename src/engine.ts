export const actions = ['idle','happy','celebrate','joyfulLaugh','sad','panic','pray','tearful','idlePeek','idleSmug','idleNervous','sleep','offline','hello'] as const;
export type Action = typeof actions[number];
export type Quote = {symbol:string;price:number;pct:number;fetchedAt:string;source:string};
export function mood(pct:number, threshold=3):Action {
  if (!Number.isFinite(pct)) return 'offline';
  if (pct >= threshold) return 'celebrate';
  if (pct <= -threshold) return 'panic';
  if (pct >= 0.5) return 'happy';
  if (pct <= -0.5) return 'sad';
  return 'idle';
}
export function sessionOpen(date=new Date()):boolean {
  const parts = new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Shanghai',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
  const p = Object.fromEntries(parts.map(x=>[x.type,x.value]));
  const minutes=Number(p.hour)*60+Number(p.minute);
  return !['Sat','Sun'].includes(p.weekday) && ((minutes>=570 && minutes<=690)||(minutes>=780 && minutes<=900));
}
export class Reactions {
  private previous:Action='idle'; private last=-Infinity;
  next(pct:number, now:number, threshold=3):Action|null {
    const desired=mood(pct,threshold);
    if (desired===this.previous || now-this.last<60000) return null;
    // A small hysteresis band prevents oscillation around the big-move threshold.
    if(this.previous==='celebrate' && pct>threshold-0.2 && pct<threshold) return null;
    if(this.previous==='panic' && pct< -threshold+0.2 && pct> -threshold) return null;
    this.previous=desired;this.last=now;return desired;
  }
}
