alter table bridge_destinations add column remote_guild_id text,add column intake_channel_id text,add column trusted_sender_id text,add column topic_groups jsonb not null default '{}',add column revision integer not null default 0;
create unique index bridge_guild_peer on bridge_destinations(guild_id,remote_guild_id,protocol) where remote_guild_id is not null;
alter table bridge_deliveries add column attempts integer not null default 0,add column updated_at timestamptz not null default now(),add column remote_report_id uuid;
create table bridge_ingestions(guild_id text not null references server_config on delete cascade,bridge_id uuid not null references bridge_destinations on delete cascade,source_id text not null,report_id uuid not null references intel_reports on delete cascade,primary key(guild_id,bridge_id,source_id));
create or replace function codex_bridge(p_guild text,p_action text,p_actor text,p_id uuid default null,p_data jsonb default '{}') returns jsonb language plpgsql set search_path=public as $$
declare b bridge_destinations;peer bridge_destinations;r intel_reports;result jsonb;item jsonb;new_id uuid;remote_topic text;marker text;begin
 perform pg_advisory_xact_lock(hashtext('bridge:'||p_guild));
 if not exists(select 1 from server_config where guild_id=p_guild) then raise exception 'Configure this server first';end if;
 if p_action='list' then return coalesce((select jsonb_agg(to_jsonb(x)||jsonb_build_object('counts',(select jsonb_object_agg(status,n) from(select status,count(*) n from bridge_deliveries where bridge_id=x.id group by status)c))) from(select * from bridge_destinations where guild_id=p_guild order by name,id limit 25 offset greatest(0,coalesce((p_data->>'page')::integer,0))*25)x),'[]');
 elsif p_action='setup' then
  if p_data->>'remote'=p_guild or length(coalesce(p_data->>'remote','')) not between 1 and 30 then raise exception 'A different source/remote guild is required';end if;
  if p_data->>'protocol'='codex-v1' and not exists(select 1 from server_config where guild_id=p_data->>'remote') then raise exception 'Remote guild must be configured on this Codex installation';end if;
  if p_data->>'protocol'='legacy-wayfinder' and (p_data->>'channel' is null or p_data->>'sender' is null) then raise exception 'Legacy intake channel and trusted sender required';end if;
  insert into bridge_destinations(guild_id,name,protocol,endpoint,remote_guild_id,intake_channel_id,trusted_sender_id,active) values(p_guild,p_data->>'name',p_data->>'protocol',p_data->>'remote',p_data->>'remote',p_data->>'channel',p_data->>'sender',true)
  on conflict(guild_id,remote_guild_id,protocol) where remote_guild_id is not null do update set name=excluded.name,intake_channel_id=excluded.intake_channel_id,trusted_sender_id=excluded.trusted_sender_id,active=true,revision=bridge_destinations.revision+1 returning * into b;result:=to_jsonb(b);
 elsif p_action='legacy-intakes' then return coalesce((select jsonb_agg(to_jsonb(x)) from bridge_destinations x where guild_id=p_guild and protocol='legacy-wayfinder' and active),'[]');
 elsif p_action='queue' then
  insert into bridge_deliveries(bridge_id,report_id,status) select bd.id,ir.id,case when ir.confidential or (length(sc.confidentiality_marker)>0 and position(lower(sc.confidentiality_marker) in lower(ir.body))>0) then 'BLOCKED' else 'QUEUED' end from bridge_destinations bd join intel_reports ir on ir.guild_id=bd.guild_id join server_config sc on sc.guild_id=bd.guild_id where bd.guild_id=p_guild and bd.active and bd.protocol='codex-v1' and ir.delivery_status='PUBLISHED' and not(ir.adapter_metadata ? 'bridge') on conflict do nothing;
  return coalesce((select jsonb_agg(to_jsonb(x)) from(select d.* from bridge_deliveries d join bridge_destinations bd on bd.id=d.bridge_id where bd.guild_id=p_guild and bd.active and d.status in('QUEUED','FAILED') order by d.updated_at,d.report_id limit 25)x),'[]');
 else
  select * into b from bridge_destinations where guild_id=p_guild and id=p_id for update;if not found then raise exception 'Bridge not found';end if;
  if p_action='get' then return to_jsonb(b)||jsonb_build_object('counts',(select jsonb_object_agg(status,n) from(select status,count(*) n from bridge_deliveries where bridge_id=b.id group by status)x));end if;
  if p_data ? 'revision' and b.revision<>(p_data->>'revision')::integer then raise exception 'Bridge changed; reopen this panel';end if;
  if p_action='disable' then update bridge_destinations set active=false,revision=revision+1 where id=b.id returning * into b;result:=to_jsonb(b);
  elsif p_action='group-set' then
   if length(p_data->>'group') not between 1 and 60 or jsonb_typeof(p_data->'topics')<>'object' or length((p_data->'topics')::text)>10000 then raise exception 'Invalid topic group';end if;
   update bridge_destinations set topic_groups=jsonb_set(topic_groups,array[p_data->>'group'],p_data->'topics'),revision=revision+1 where id=b.id returning * into b;result:=to_jsonb(b);
  elsif p_action='group-remove' then update bridge_destinations set topic_groups=topic_groups-(p_data->>'group'),revision=revision+1 where id=b.id returning * into b;result:=to_jsonb(b);
  elsif p_action='blocked' then update bridge_deliveries set status='BLOCKED',updated_at=now() where bridge_id=b.id and report_id=(p_data->>'report')::uuid and status in('QUEUED','FAILED');return '{}';
  elsif p_action='failure' then update bridge_deliveries set status='FAILED',detail=left(p_data->>'detail',500),attempts=attempts+1,updated_at=now() where bridge_id=b.id and report_id=(p_data->>'report')::uuid and status in('QUEUED','FAILED');return '{}';
  elsif p_action='deliver' then
   if not b.active or b.protocol<>'codex-v1' then raise exception 'Bridge is inactive or incompatible';end if;
   select * into peer from bridge_destinations where guild_id=b.remote_guild_id and remote_guild_id=p_guild and active and protocol='codex-v1';
   if not found then raise exception 'Remote administrator must configure the reciprocal bridge';end if;
   item:=p_data->'envelope';if item->>'type' is distinct from 'codex.report' or item->>'version' is distinct from '1' or item->>'destinationGuildId' is distinct from b.remote_guild_id or item->'report'->>'originGuildId' is distinct from p_guild then raise exception 'Invalid bridge envelope identity/version';end if;
   select * into r from intel_reports where guild_id=p_guild and id=(item->'report'->>'id')::uuid;
   if not found or r.body is distinct from item->'report'->>'body' or r.delivery_status<>'PUBLISHED' or r.adapter_metadata ? 'bridge' then raise exception 'Report is not eligible or envelope differs from persisted source';end if;
   select confidentiality_marker into marker from server_config where guild_id=p_guild;
   if r.confidential or (length(marker)>0 and position(lower(marker) in lower(r.body))>0) then update bridge_deliveries set status='BLOCKED',updated_at=now() where bridge_id=b.id and report_id=r.id;return jsonb_build_object('status','BLOCKED');end if;
   select remote_report_id into new_id from bridge_deliveries where bridge_id=b.id and report_id=r.id and status='DELIVERED';if found then return jsonb_build_object('status','DELIVERED','id',new_id);end if;
   select mapping.value into remote_topic from jsonb_each(b.topic_groups) grp cross join lateral jsonb_each_text(grp.value) mapping where mapping.key=coalesce(r.topic,'*') order by grp.key limit 1;
   if remote_topic is not null and not exists(select 1 from intel_topics where guild_id=b.remote_guild_id and name=remote_topic) then raise exception 'Mapped destination topic does not exist';end if;
   new_id:=gen_random_uuid();select confidentiality_marker into marker from server_config where guild_id=b.remote_guild_id;
   insert into intel_reports(id,guild_id,body,source,author_id,reporter_id,source_channel_id,source_message_id,created_at,delivery_status,topic,confidential,adapter_metadata) values(new_id,b.remote_guild_id,r.body,'codex',r.author_id,r.reporter_id,r.source_channel_id,r.source_message_id,r.created_at,'AT_HQ',remote_topic,length(marker)>0 and position(lower(marker) in lower(r.body))>0,jsonb_build_object('bridge',peer.id,'originGuildId',p_guild,'originReportId',r.id,'sourceTrailmarkId',r.source_trailmark_id,'mappedTopic',remote_topic));
   insert into bridge_deliveries(bridge_id,report_id,status,remote_report_id,attempts) values(b.id,r.id,'DELIVERED',new_id,1) on conflict(bridge_id,report_id) do update set status='DELIVERED',remote_report_id=new_id,attempts=bridge_deliveries.attempts+1,detail=null,updated_at=now();
   insert into audit_events(guild_id,actor_id,subject_id,event_type,detail) values(b.remote_guild_id,p_actor,new_id::text,'BRIDGE_RECEIVED',jsonb_build_object('sourceGuild',p_guild,'bridge',peer.id));result:=jsonb_build_object('status','DELIVERED','id',new_id);
  elsif p_action='ingest' then
   if not b.active or b.protocol<>'legacy-wayfinder' or b.intake_channel_id is distinct from p_data->>'channel' or b.trusted_sender_id is distinct from p_data->>'sender' then raise exception 'Unauthorized legacy intake';end if;
   select report_id into new_id from bridge_ingestions where guild_id=p_guild and bridge_id=b.id and source_id=p_data->>'source';if found then return jsonb_build_object('id',new_id);end if;
   item:=p_data->'report';if item->>'originGuildId' is distinct from b.remote_guild_id or item->>'source' is distinct from 'legacy-wayfinder' or length(item->>'body') not between 1 and 4000 then raise exception 'Invalid legacy report';end if;
   select confidentiality_marker into marker from server_config where guild_id=p_guild;
   if coalesce((item->>'confidential')::boolean,false) or (length(marker)>0 and position(lower(marker) in lower(item->>'body'))>0) then raise exception 'Confidential report rejected at bridge intake';end if;
   new_id:=gen_random_uuid();insert into intel_reports(id,guild_id,body,source,created_at,delivery_status,source_channel_id,source_message_id,adapter_metadata) values(new_id,p_guild,item->>'body','legacy-wayfinder',(item->>'createdAt')::timestamptz,'AT_HQ',p_data->>'channel',p_data->>'source',jsonb_build_object('bridge',b.id,'originGuildId',b.remote_guild_id,'legacyId',item->>'id'));
   insert into bridge_ingestions values(p_guild,b.id,p_data->>'source',new_id);result:=jsonb_build_object('id',new_id);
  else raise exception 'Unknown bridge action';end if;
 end if;
 insert into audit_events(guild_id,actor_id,subject_id,event_type,detail) values(p_guild,p_actor,coalesce(b.id::text,p_id::text),'BRIDGE_'||upper(p_action),jsonb_build_object('id',b.id));return result;
end $$;
do $$ declare t text;begin foreach t in array array['bridge_destinations','bridge_deliveries','bridge_ingestions'] loop execute format('alter table %I enable row level security',t);execute format('grant select,insert,update,delete on %I to service_role',t);end loop;end $$;
revoke all on function codex_bridge(text,text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function codex_bridge(text,text,text,uuid,jsonb) to service_role;
