import {DurableDelivery,type IntelligenceStore,type DurablePublisher} from './intelligence.js';
export interface WorkflowStore extends IntelligenceStore {workflow<T=any>(guild:string,system:string,action:string,actor:string,id?:string,data?:Record<string,unknown>):Promise<T>}
export interface MessageEditor extends DurablePublisher {edit(channel:string,message:string,body:string):Promise<boolean>}
export class DurableSummary {
 constructor(private readonly store:WorkflowStore,private readonly editor:MessageEditor){}
 async refresh(guild:string,key:string,channel:string,body:string):Promise<string>{
  const current=await this.store.workflow(guild,'message','get','system',undefined,{key});
  if(current&&current.channel_id===channel&&await this.editor.edit(channel,current.message_id,body))return current.message_id;
  const id=await new DurableDelivery(this.store,this.editor).deliver(guild,`summary:${key}:${channel}:${current?.message_id??'initial'}`,channel,body);
  await this.store.workflow(guild,'message','save','system',undefined,{key,channel,message:id});return id;
 }
}
