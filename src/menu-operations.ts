// Tauri's popup holds the webview menu resource lock until the menu closes.
// Never issue another menu-resource IPC while that popup is pending.
export class MenuOperations {
  private tail:Promise<unknown>=Promise.resolve();
  private opening=false;
  run<T>(operation:()=>Promise<T>):Promise<T>{
    const result=this.tail.then(operation);
    this.tail=result.catch(()=>{});
    return result;
  }
  popup(operation:()=>Promise<void>):Promise<void>{
    if(this.opening)return Promise.resolve();
    this.opening=true;
    return this.run(operation).finally(()=>{this.opening=false;});
  }
}
