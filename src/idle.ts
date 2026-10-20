import type {Action} from './engine';
export const ambientActions=['idlePeek','idleSmug','idleNervous'] as const;
export type AmbientAction=typeof ambientActions[number];
const weights:Record<AmbientAction,number>={idlePeek:4,idleSmug:3,idleNervous:1};
// Only take a variation at a completed base-loop boundary. Returning to rest
// starts a fresh quiet interval; interruption never leaves an overdue action.
export class IdleSchedule {
  private due=Infinity;
  private previous:AmbientAction|null=null;
  reset(now:number,random= Math.random){this.due=now+25000+Math.floor(random()*30000);}
  suspend(){this.due=Infinity;}
  next(now:number,available:readonly Action[],random=Math.random):AmbientAction|null {
    if(now<this.due)return null;
    const candidates=ambientActions.filter(a=>available.includes(a)&&a!==this.previous);
    if(!candidates.length)return null;
    const total=candidates.reduce((n,a)=>n+weights[a],0);
    let ticket=Math.min(Math.max(random(),0),1-Number.EPSILON)*total;
    let selected=candidates[candidates.length-1];
    for(const a of candidates){ticket-=weights[a];if(ticket<0){selected=a;break;}}
    this.previous=selected;this.suspend();return selected;
  }
}
