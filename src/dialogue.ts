// Includes translated work quotes and community memes, not all spoken by Kurumi.
// Attribution and verification limits are documented in DIALOGUE.md.
export const idleQuotes=['利润……去哪了？','神啊——','没办法了！手指屏障！','不行……笑意……忍不住了……','FX，简单！','要涨就别跌啊！混蛋！','完全看懂走势了！','老实赚钱，很枯燥的对吧？'];
export class IdleDialogue{
 private due=Infinity;
 private previous:string|undefined;
 reset(now:number,random=Math.random){this.due=now+30000+Math.floor(random()*30000);}
 next(now:number,random=Math.random):string|null{
  if(now<this.due)return null;
  const choices=idleQuotes.filter(line=>line!==this.previous);
  const line=choices[Math.floor(Math.min(Math.max(random(),0),1-Number.EPSILON)*choices.length)];
  this.previous=line;this.reset(now,random);return line;
 }
}
