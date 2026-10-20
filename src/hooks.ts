import type {Action} from './engine';
import type {MarketQuote} from './market-alerts';
export const hookActions:Action[]=['idle','happy','celebrate','joyfulLaugh','sad','panic','pray','tearful','idlePeek','idleSmug','idleNervous'];
export type Reaction={action:Action;line?:string;market?:MarketQuote};
const events={
 task_started:[{action:'idlePeek',line:'开始啦，让我看看这次的机会。'}],
 working:[{action:'idlePeek',line:'还在努力呢……我陪你等结果。'},{action:'idleNervous',line:'稳住，先把眼前这一步做好。'}],
 waiting_for_user:[{action:'pray',line:'到你决定的时候了……拜托啦。'}],
 task_succeeded:[{action:'happy',line:'成功了！这次真的做到了。'},{action:'celebrate',line:'完成啦……嘿嘿，笑意藏不住了！'}],
 task_failed:[{action:'sad',line:'没成功啊……让我缓一下。'},{action:'panic',line:'怎、怎么会这样！先看看哪里出错了。'},{action:'tearful',line:'呜……这次失败了。我还在这里陪你。'}],
 task_cancelled:[{action:'idle',line:'先停在这里，休息一下吧。'}]
} satisfies Record<string,Reaction[]>;
export const hookEvents=Object.keys(events);
export const actionLines:Partial<Record<Action,string>>={idle:'我在这里，慢慢来。',happy:'有一点点开心，藏不住了。',celebrate:'嘿嘿，笑意藏不住了！',joyfulLaugh:'哈哈……眼泪都笑出来了！',sad:'让我缓一下……',panic:'怎、怎么会这样！',pray:'拜托了，这次一定要顺利。',tearful:'呜……我还没有认输。',idlePeek:'就看一眼……',idleSmug:'哼哼，今天状态不错。',idleNervous:'没、没什么好紧张的。'};
export function parseHook(value:unknown,random=Math.random,now=Date.now()):Reaction|null{
 if(!value||typeof value!=='object')return null;
 const event=value as {event?:unknown;action?:unknown;createdAt?:unknown};
 if(typeof event.createdAt!=='number'||!Number.isFinite(event.createdAt)||Math.abs(now-event.createdAt)>60000)return null;
 if(typeof event.event==='string'&&Object.hasOwn(events,event.event)){
  const candidates=events[event.event as keyof typeof events];
  return {...candidates[Math.floor(Math.min(Math.max(random(),0),1-Number.EPSILON)*candidates.length)]};
 }
 if(event.event!==undefined)return null;
 if(typeof event.action!=='string'||!hookActions.includes(event.action as Action))return null;
 const action=event.action as Action;
 return {action,line:actionLines[action]};
}
// Every accepted trigger is retained, including repeated actions. Only the
// playback boundary may consume this queue; receiving an event never interrupts.
export class ActionQueue{
 private pending:Reaction[]=[];
 push(reaction:Reaction){if(this.pending.length>=64)return false;this.pending.push(reaction);return true;}
 next(){return this.pending.shift();}
 get length(){return this.pending.length;}
}
