import {canonicalReport,type IntelligenceStore,type ReportRow} from './intelligence.js';
import {BridgeService} from './services.js';
import {legacyWayfinderAdapter,nativeAdapter,mayTransfer} from './reports.js';
export interface BridgeRow {id:string;guild_id:string;remote_guild_id:string;name:string;protocol:'codex-v1'|'legacy-wayfinder';active:boolean;revision:number;topic_groups:Record<string,Record<string,string>>;intake_channel_id?:string;trusted_sender_id?:string;counts?:Record<string,number>}
export interface BridgeStore extends IntelligenceStore {bridge<T=unknown>(guild:string,action:string,actor:string,id?:string,data?:Record<string,unknown>):Promise<T>}
export class BridgeCoordinator {
 constructor(private readonly store:BridgeStore){}
 async drain(guild:string,marker:string):Promise<{delivered:number;failed:number}>{let delivered=0,failed=0;
  for(const item of await this.store.bridge<Array<{bridge_id:string;report_id:string}>>(guild,'queue','system')){
   try{const bridge=await this.store.bridge<BridgeRow>(guild,'get','system',item.bridge_id),row=await this.store.intelligence<ReportRow>(guild,'report-get','system',item.report_id),report=canonicalReport(row,marker);
    let status='';const ok=await new BridgeService().transfer(report,marker,{send:async payload=>{nativeAdapter.parse(payload);const envelope={...JSON.parse(payload),destinationGuildId:bridge.remote_guild_id};status=(await this.store.bridge<{status:string}>(guild,'deliver','system',bridge.id,{envelope})).status;}},'codex-v1');if(ok&&status==='DELIVERED')delivered++;if(!ok)await this.store.bridge(guild,'blocked','system',bridge.id,{report:report.id});
   }catch(error){failed++;await this.store.bridge(guild,'failure','system',item.bridge_id,{report:item.report_id,detail:error instanceof Error?error.message:'Bridge delivery failed'});}
  }return {delivered,failed};
 }
 async ingest(guild:string,channel:string,sender:string,messageId:string,payload:string,marker:string):Promise<string|undefined>{
  const bridges=await this.store.bridge<BridgeRow[]>(guild,'legacy-intakes','system');const bridge=bridges.find(b=>b.intake_channel_id===channel&&b.trusted_sender_id===sender);if(!bridge)return undefined;
  const report=legacyWayfinderAdapter.parse(payload,bridge.remote_guild_id);if(!mayTransfer(report,marker))throw new Error('Confidential legacy report cannot cross a bridge');
  const result=await this.store.bridge<{id:string}>(guild,'ingest',sender,bridge.id,{channel,sender,source:messageId,report});return result.id;
 }
}
