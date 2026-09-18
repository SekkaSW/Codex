import { classifyReport, isConfidential, type CodexReport } from './reports.js';
export interface ReportRow {id:string;guild_id:string;body:string;created_at:string;source:'codex'|'legacy-wayfinder';author_id?:string;reporter_id?:string;source_trailmark_id?:string;source_channel_id?:string;source_message_id?:string;topic?:string;delivery_status:'CAPTURED'|'AT_HQ'|'PUBLISHED';confidential:boolean;linked_contact_ids:string[];linked_group_ids:string[];adapter_metadata:Record<string,unknown>}
export interface TopicRow {id:string;name:string;keywords:string[];priority:number;revision:number}
export interface ContactRow {id:string;guild_id:string;name:string;description:string;kind:'CONTACT'|'GROUP';active:boolean;forum_thread_id?:string;revision:number;contacts?:string[];members?:string[]}
export interface IntelligenceStore {intelligence<T=unknown>(guild:string,action:string,actor:string,id?:string,data?:Record<string,unknown>):Promise<T>}
export interface DeliveryReceipt {state:'READY'|'SENDING'|'SENT';channel_id:string;message_id?:string;claimed:boolean}
export interface DurablePublisher {send(channel:string,key:string,body:string):Promise<string>;recover(channel:string,key:string):Promise<string|undefined>}
/** A lost Discord response must never turn into an unconditional second send. */
export class DurableDelivery {
 constructor(private readonly store:IntelligenceStore,private readonly publisher:DurablePublisher){}
 async deliver(guild:string,key:string,channel:string,body:string):Promise<string>{
  const receipt=await this.store.intelligence<DeliveryReceipt>(guild,'delivery-claim','system',undefined,{key,channel});
  if(receipt.state==='SENT')return receipt.message_id!;
  const message=receipt.claimed?await this.publisher.send(channel,key,body):await this.publisher.recover(channel,key);
  if(!message)throw new Error(`Delivery ${key} has an uncertain Discord outcome. Inspect its destination and recover its receipt; it will not be sent twice automatically`);
  await this.store.intelligence(guild,'delivery-complete','system',undefined,{key,message});return message;
 }
}
export function canonicalReport(row:ReportRow,marker:string):CodexReport{return {id:row.id,originGuildId:row.guild_id,body:row.body,createdAt:row.created_at,source:row.source,...(row.author_id?{authorId:row.author_id}:{}),...(row.topic?{topic:row.topic}:{}),reporterId:row.reporter_id,sourceTrailmarkId:row.source_trailmark_id,sourceChannelId:row.source_channel_id,sourceMessageId:row.source_message_id,confidential:row.confidential||isConfidential(row.body,marker),hqDeliveryState:row.delivery_status,linkedContactIds:row.linked_contact_ids,linkedGroupIds:row.linked_group_ids,adapterMetadata:row.adapter_metadata};}
export interface IntelligenceDestinations {topic(topic?:TopicRow):Promise<string>;contact(contact:ContactRow):Promise<string>}
export class IntelligencePipeline {
 constructor(private readonly store:IntelligenceStore,private readonly delivery:DurableDelivery,private readonly destinations:IntelligenceDestinations){}
 async process(guild:string,id:string):Promise<boolean>{
  let report=await this.store.intelligence<ReportRow>(guild,'report-get','system',id);if(report.delivery_status==='CAPTURED')return false;
  const topics=await this.store.intelligence<TopicRow[]>(guild,'topics','system');
  const name=report.delivery_status==='PUBLISHED'?report.topic:classifyReport(report.body,topics);
  report=await this.store.intelligence<ReportRow>(guild,'report-classify','system',id,{topic:name??null});
  const body=`Report ${id}\n${report.author_id?`Reporter: ${report.author_id}\n`:''}${report.body}`;
  const channel=await this.destinations.topic(topics.find(t=>t.name===name));
  await this.delivery.deliver(guild,`report:${id}`,channel,body);
  await this.store.intelligence(guild,'report-published','system',id);
  for(const contact of await this.store.intelligence<ContactRow[]>(guild,'report-contacts','system',id))await this.delivery.deliver(guild,`contact:${id}:${contact.id}`,await this.destinations.contact(contact),body);
  return true;
 }
 async batch(guild:string,page=0):Promise<{processed:number;failures:string[]}>{let processed=0;const failures:string[]=[];for(const report of await this.store.intelligence<ReportRow[]>(guild,'pending','system',undefined,{page})){try{if(await this.process(guild,report.id))processed++;}catch(error){failures.push(`${report.id}: ${error instanceof Error?error.message:'Delivery failed'}`);}}return {processed,failures};}
}
