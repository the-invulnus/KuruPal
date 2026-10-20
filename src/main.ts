import './style.css';
import {MenuOperations} from './menu-operations';
import {invoke,isTauri} from '@tauri-apps/api/core';
import {listen} from '@tauri-apps/api/event';
import {getCurrentWindow,currentMonitor} from '@tauri-apps/api/window';
import {Menu,CheckMenuItem} from '@tauri-apps/api/menu';
import {LogicalPosition,LogicalSize,PhysicalPosition} from '@tauri-apps/api/dpi';
import {type Action,sessionOpen} from './engine';
import {marketChangeText,type MarketQuote} from './market-alerts';
import {Renderer,builtinPack} from './media';
import {ActionQueue,parseHook,type Reaction} from './hooks';
import {IdleSchedule} from './idle';
import {IdleDialogue} from './dialogue';
import {MarketMonitor,parseWatchlist,type MarketResult} from './market';

const labels:Partial<Record<Action,string>>={idle:'待机',happy:'手机兴奋',celebrate:'捂嘴狂笑',joyfulLaugh:'仰头含泪大笑',sad:'放空发呆',panic:'抱头崩溃',pray:'紧张祈祷',tearful:'抱头泪崩',idlePeek:'偷偷确认',idleSmug:'脑内小赚',idleNervous:'藏住不安'};
const app=document.querySelector<HTMLElement>('#app')!;
app.innerHTML='<div id="bubble" role="status" aria-live="polite" hidden></div><div id="character" tabindex="0" aria-label="久留美桌宠，右键选择动作"></div><p id="error" role="status" hidden></p><dialog id="stocks" aria-labelledby="stocks-title"><header><strong id="stocks-title">关注股票</strong><button id="stocks-close" aria-label="关闭股票设置">×</button></header><p class="stocks-hint">A股六位代码 · 最多5只<br>盘中每分钟采集，达到阈值才提醒</p><form id="stock-add"><input id="stock-code" aria-label="股票代码" placeholder="例如 000001" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" required><button type="submit">添加</button></form><ul id="stock-list"></ul><p id="stock-status" role="status"></p><p id="stock-message" role="alert"></p></dialog>';
const character=document.querySelector<HTMLElement>('#character')!;
const error=document.querySelector<HTMLElement>('#error')!;
const media=builtinPack(),queue=new ActionQueue();
const idleSchedule=new IdleSchedule();
const dialogue=new IdleDialogue();
const bubble=document.querySelector<HTMLElement>('#bubble')!;
const bubbleSpace=90;
let bubbleTimer=0;
function hideBubble(){window.clearTimeout(bubbleTimer);bubble.hidden=true;}
function say(line:string,market?:MarketQuote){
  window.clearTimeout(bubbleTimer);bubble.textContent=line;bubble.title='';
  if(market){
    bubble.replaceChildren();
    const identity=document.createElement('span');identity.className='quote-identity';identity.textContent=`${market.symbol} ¥${market.price.toFixed(2)}`;
    const change=document.createElement('strong');change.className=market.changePct>0?'quote-up':market.changePct<0?'quote-down':'quote-flat';
    change.textContent=marketChangeText(market);
    bubble.append(identity,change);bubble.title=`采集于 ${new Date(market.fetchedAt).toLocaleTimeString()}；非上游交易时间`;
  }
  bubble.hidden=false;
  bubbleTimer=window.setTimeout(hideBubble,7000);
}
const sizes={small:220,medium:320,large:420} as const;
type PetSize=keyof typeof sizes;
let selectedSize:PetSize='medium';
try{const saved=localStorage.getItem('pet-size');if(saved&&Object.hasOwn(sizes,saved))selectedSize=saved as PetSize;}catch{}
let watchlist:string[]=[];
try{watchlist=parseWatchlist(JSON.parse(localStorage.getItem('watchlist')??'[]'));}catch{}
const stockDialog=document.querySelector<HTMLDialogElement>('#stocks')!;
const stockStatus=document.querySelector<HTMLElement>('#stock-status')!;
const stockMessage=document.querySelector<HTMLElement>('#stock-message')!;
let savedMarketState:unknown={};
try{savedMarketState=JSON.parse(localStorage.getItem('market-alerts-v1')??'{}');}catch{}
function marketLog(value:unknown){if(isTauri())void invoke('market_log',{value}).catch(()=>{});}
const marketMonitor=new MarketMonitor(symbols=>invoke<MarketResult>('quotes',{symbols}),enqueue,text=>{stockStatus.textContent=text;},Date.now,savedMarketState,state=>localStorage.setItem('market-alerts-v1',JSON.stringify(state)),marketLog);
let previousMarketGate='';
function pollMarket(){const gate=!watchlist.length?'no_symbols':sessionOpen()?'session_open':'outside_session';if(gate!==previousMarketGate){marketLog({event:'poll_gate',gate,symbols:watchlist,version:'0.3.3'});previousMarketGate=gate;}if(gate==='session_open')void marketMonitor.tick();}
marketMonitor.setSymbols(watchlist);
function renderWatchlist(){
  const list=document.querySelector<HTMLElement>('#stock-list')!;list.replaceChildren();
  for(const symbol of watchlist){
    const row=document.createElement('li'),code=document.createElement('span'),remove=document.createElement('button');
    code.textContent=symbol;remove.textContent='移除';remove.setAttribute('aria-label',`移除 ${symbol}`);
    remove.onclick=()=>saveWatchlist(watchlist.filter(s=>s!==symbol));row.append(code,remove);list.append(row);
  }
  if(!watchlist.length)list.textContent='暂未关注股票';
}
async function saveWatchlist(next:string[]){
  try{
    next=parseWatchlist(next);
    if(isTauri()){await settingsTask(()=>updateSettings({watchlist:next}));return true;}
    localStorage.setItem('watchlist',JSON.stringify(next));watchlist=next;
    marketMonitor.setSymbols(watchlist);renderWatchlist();stockMessage.textContent='已保存';
    if(isTauri())pollMarket();
    return true;
  }catch(e){stockMessage.textContent=e instanceof Error?e.message:String(e);return false;}
}
function openStocks(){renderWatchlist();stockMessage.textContent='';if(!stockDialog.open)stockDialog.showModal();}
document.querySelector<HTMLElement>('#stocks-close')!.onclick=()=>stockDialog.close();
document.querySelector<HTMLFormElement>('#stock-add')!.onsubmit=async event=>{
  event.preventDefault();const input=document.querySelector<HTMLInputElement>('#stock-code')!;const code=input.value.trim();
  if(watchlist.includes(code)){stockMessage.textContent='已经关注这只股票';return;}
  if(await saveWatchlist([...watchlist,code]))input.value='';
};
// Removed symbols and stale queued quotes must not produce misleading bubbles.
function nextReaction():Reaction|undefined{
  let reaction:Reaction|undefined;
  while((reaction=queue.next())){
    if(!reaction.market||(watchlist.includes(reaction.market.symbol)&&Date.now()-Date.parse(reaction.market.fetchedAt)<=180000))return reaction;
  }
}
const renderer=new Renderer(character,message=>{error.hidden=false;error.textContent=message;});
function play(reaction:Reaction){
  if(reaction.market)marketLog({event:'action_play',symbol:reaction.market.symbol,action:reaction.action});
  const {action,line}=reaction;
  if(action==='idle')idleSchedule.reset(Date.now());else idleSchedule.suspend();
  renderer.play(action,media,()=>{
    const next=nextReaction();
    if(next)play(next);else if(action!=='idle')play({action:'idle'});
  },()=>{
    const next=nextReaction();
    if(next){play(next);return;}
    if(action!=='idle'||document.hidden)return;
    const quote=dialogue.next(Date.now());if(quote)say(quote);
    const variation=idleSchedule.next(Date.now(),Object.keys(media.pack.actions) as Action[]);
    if(variation)play({action:variation});
  },()=>{
    if(line){say(line,reaction.market);dialogue.reset(Date.now());}
  });
}
function enqueue(reaction:Reaction){
  if(reaction.market)marketLog({event:'action_enqueue',symbol:reaction.market.symbol,action:reaction.action,queueLength:queue.length});
  if(!queue.push(reaction)){error.hidden=false;error.textContent='待播动作已达64条，请稍后再试。';}
  // Any external activity postpones idle chatter, even while its action waits.
  dialogue.reset(Date.now());
}
function manual(action:Action){enqueue({action});}
async function resize(size:PetSize){
  const win=getCurrentWindow(),monitor=await currentMonitor();
  const [position,oldSize]=await Promise.all([win.outerPosition(),win.outerSize()]);
  const scale=monitor?.scaleFactor??await win.scaleFactor();
  const area=monitor?.workArea;
  const side=Math.min(sizes[size],area?Math.min(area.size.width/scale,area.size.height/scale-bubbleSpace):Infinity);
  const physicalSide=side*scale;
  const physicalHeight=(side+bubbleSpace)*scale;
  // Keep the feet anchored, then clamp the whole pet inside the display.
  let x=position.x+(oldSize.width-physicalSide)/2,y=position.y+oldSize.height-physicalHeight;
  if(area){
    x=Math.max(area.position.x,Math.min(x,area.position.x+area.size.width-physicalSide));
    y=Math.max(area.position.y,Math.min(y,area.position.y+area.size.height-physicalHeight));
  }
  await win.setSize(new LogicalSize(side,side+bubbleSpace));
  await win.setPosition(new PhysicalPosition(Math.round(x),Math.round(y)));
  selectedSize=size;
  try{localStorage.setItem('pet-size',size);}catch{}
}
type PetSettings={size:PetSize;watchlist:string[];opacity?:number};
const sizeItems=new Map<PetSize,CheckMenuItem>();
const opacityItems=new Map<number,CheckMenuItem>();
let selectedOpacity=100;
const menuOperations=new MenuOperations();
let checkedSize:PetSize|undefined;
let checkedOpacity:number|undefined;
let settingsChain:Promise<unknown>=Promise.resolve();
function settingsTask<T>(work:()=>Promise<T>):Promise<T>{
  const next=settingsChain.then(work);settingsChain=next.catch(()=>{});return next;
}
async function syncOpacityMenu(){
  if(!opacityItems.size||checkedOpacity===selectedOpacity)return;
  const opacity=selectedOpacity;
  await menuOperations.run(async()=>{
    for(const [key,item] of opacityItems)await item.setChecked(key===opacity);
    checkedOpacity=opacity;
  });
}
async function applySettings(settings:PetSettings){
  if(!Object.hasOwn(sizes,settings.size))throw Error('无效的桌宠大小');
  const opacity=settings.opacity??100;
  if(!Number.isInteger(opacity)||opacity<25||opacity>100)throw Error('无效的透明度');
  const next=parseWatchlist(settings.watchlist);
  if(settings.size!==selectedSize)await resize(settings.size);
  if(opacity!==selectedOpacity){
    selectedOpacity=opacity;app.style.setProperty('--pet-opacity',String(opacity/100));
  }
  if(JSON.stringify(next)!==JSON.stringify(watchlist)){
    watchlist=next;localStorage.setItem('watchlist',JSON.stringify(next));
    marketMonitor.setSymbols(next);renderWatchlist();pollMarket();
  }
  if(sizeItems.size&&checkedSize!==selectedSize){
    const size=selectedSize;
    await menuOperations.run(async()=>{
      for(const [key,item] of sizeItems)await item.setChecked(key===size);
      checkedSize=size;
    });
  }
  await syncOpacityMenu();
}
async function updateSettings(patch:Partial<PetSettings>){
  await applySettings(await invoke<PetSettings>('pet_settings',{patch}));
  stockMessage.textContent='已保存';
}
async function start(){
  dialogue.reset(Date.now());
  play({action:'idle'});
  if(!isTauri())return;
  const initial=await invoke<PetSettings>('pet_settings',{initial:{size:selectedSize,watchlist}});
  await applySettings(initial);
  for(const [size,text] of [['small','小'],['medium','中'],['large','大']] as const){
    sizeItems.set(size,await CheckMenuItem.new({
      id:`size-${size}`,text,checked:selectedSize===size,
      action:()=>{
        void settingsTask(()=>updateSettings({size})).catch(e=>{
          error.hidden=false;error.textContent='尺寸调整失败：'+String(e);
        });
      }
    }));
  }
  checkedSize=selectedSize;
  for(const opacity of [100,75,50,25]){
    opacityItems.set(opacity,await CheckMenuItem.new({
      id:`opacity-${opacity}`,text:`${100-opacity}%`,checked:selectedOpacity===opacity,
      action:()=>{
        void settingsTask(async()=>{
          // Native check items toggle themselves, even when selecting the
          // current value. Restore the saved selection on success or failure.
          checkedOpacity=undefined;
          try{await updateSettings({opacity});}finally{await syncOpacityMenu();}
        }).catch(e=>{
          error.hidden=false;error.textContent='透明度调整失败：'+String(e);
        });
      }
    }));
  }
  checkedOpacity=selectedOpacity;
  await resize(selectedSize).catch(e=>{error.hidden=false;error.textContent='尺寸恢复失败：'+String(e);});
  const clickThrough=await CheckMenuItem.new({
    id:'click-through',text:'点击穿透：已关闭',checked:false,
    action:()=>{void invoke<boolean>('toggle_click_through').catch(e=>{
      error.hidden=false;error.textContent='点击穿透切换失败：'+String(e);
      void invoke<boolean>('click_through_enabled').then(syncClickThrough);
    });}
  });
  function syncClickThrough(enabled:boolean){
    return menuOperations.run(async()=>{
      await clickThrough.setChecked(enabled);
      await clickThrough.setText(enabled?'点击穿透：已开启':'点击穿透：已关闭');
    });
  }
  await listen<boolean>('click-through-changed',event=>{void syncClickThrough(event.payload);});
  await listen<string>('click-through-error',event=>{error.hidden=false;error.textContent='点击穿透切换失败：'+event.payload;});
  await listen<string>('window-control-error',event=>{error.hidden=false;error.textContent='窗口操作失败：'+event.payload;});
  const initialClickThrough=await invoke<boolean>('click_through_enabled');
  await syncClickThrough(initialClickThrough);
  const menu=await Menu.new({items:[
    ...Object.entries(labels).map(([id,text])=>({id,text:text!,action:()=>manual(id as Action)})),
    {item:'Separator'},
    {text:'桌宠大小',items:[...sizeItems.values()]},
    {text:'透明度',items:[...opacityItems.values()]},
    {id:'stocks',text:'设置关注股票…',action:openStocks},
    clickThrough,
    {id:'hide',text:'隐藏桌宠',action:()=>{
      // Wait for the native popup to close before hiding its host window.
      void menuOperations.run(()=>invoke('hide_pet')).catch(e=>{
        error.hidden=false;error.textContent='隐藏失败：'+String(e);
      });
    }},
    {item:'Separator'},
    {id:'quit',text:'退出桌宠',action:()=>{void getCurrentWindow().close();}}
  ]});
  document.addEventListener('contextmenu',event=>{event.preventDefault();void menuOperations.popup(()=>menu.popup(new LogicalPosition(event.clientX,event.clientY)));});
  character.onkeydown=event=>{if(event.key==='ContextMenu'||(event.shiftKey&&event.key==='F10')){event.preventDefault();void menuOperations.popup(()=>menu.popup());}};
  character.onpointerdown=event=>{if(event.button===0)void getCurrentWindow().startDragging();};
  // Independent bounded polling for quotes and local Agent events.
  pollMarket();
  window.setInterval(()=>pollMarket(),1000);
  async function poll(){
    try{
      const events=await invoke<unknown[]>('drain_hooks');
      for(const event of events){const reaction=parseHook(event);if(reaction)enqueue(reaction);}
    }catch(e){error.hidden=false;error.textContent='Hook 接收失败：'+String(e);}
    finally{window.setTimeout(()=>void poll(),400);}
  }
  void poll();
  async function syncSettings(){
    try{await settingsTask(async()=>applySettings(await invoke<PetSettings>('pet_settings')));}
    catch(e){marketLog({event:'settings_sync_failed',error:String(e)});}
    finally{window.setTimeout(()=>void syncSettings(),1000);}
  }
  void syncSettings();
}
void start().catch(e=>{error.hidden=false;error.textContent=String(e);});
