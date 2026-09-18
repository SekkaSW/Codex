-- Canonical report processing and local delivery receipts. All entry points are service-only.
create table intel_topics(id uuid primary key default gen_random_uuid(),guild_id text not null references server_config on delete cascade,name text not null check(length(name) between 1 and 100),keywords text[] not null default '{}',priority integer not null default 0,revision integer not null default 0,unique(guild_id,name));
alter table intel_reports add column linked_group_ids uuid[] not null default '{}',add column hq_delivered_at timestamptz,add column published_at timestamptz;
alter table contacts add column description text not null default '',add column revision integer not null default 0,add column created_at timestamptz not null default now(),add column updated_at timestamptz not null default now();
create table contact_discord_members(contact_id uuid references contacts on delete cascade,guild_id text not null references server_config on delete cascade,member_id text not null,primary key(contact_id,member_id));
create table discord_deliveries(guild_id text not null references server_config on delete cascade,delivery_key text not null,channel_id text not null,state text not null default 'READY' check(state in('READY','SENDING','SENT')),message_id text,attempted_at timestamptz,created_at timestamptz not null default now(),primary key(guild_id,delivery_key));
create or replace function codex_intelligence(p_guild text,p_action text,p_actor text,p_id uuid default null,p_data jsonb default '{}') returns jsonb language plpgsql set search_path=public as $$
declare result jsonb;r intel_reports;t intel_topics;c contacts;d discord_deliveries;ids uuid[];v_page integer:=greatest(0,least(100000,coalesce((p_data->>'page')::integer,0)));begin
 perform pg_advisory_xact_lock(hashtext(p_guild));
 if not exists(select 1 from server_config where guild_id=p_guild) then raise exception 'Server is not configured';end if;
 if p_action='topics' then return coalesce((select jsonb_agg(to_jsonb(x)) from(select * from intel_topics where guild_id=p_guild order by priority,name,id)x),'[]');
 elsif p_action='topic-save' then
  if length(trim(p_data->>'name')) not between 1 and 100 or jsonb_array_length(p_data->'keywords')>50 then raise exception 'Invalid topic name or keywords';end if;
  if p_id is null then insert into intel_topics(guild_id,name,keywords,priority) values(p_guild,p_data->>'name',array(select jsonb_array_elements_text(p_data->'keywords')),coalesce((p_data->>'priority')::integer,0)) returning * into t;
  else update intel_topics set name=p_data->>'name',keywords=array(select jsonb_array_elements_text(p_data->'keywords')),priority=coalesce((p_data->>'priority')::integer,0),revision=revision+1 where guild_id=p_guild and id=p_id and revision=(p_data->>'revision')::integer returning * into t;if not found then raise exception 'Topic changed; reopen the editor';end if;end if;result:=to_jsonb(t);
 elsif p_action='contacts' then return coalesce((select jsonb_agg(to_jsonb(x)) from(select * from contacts where guild_id=p_guild and (not(p_data ? 'kind') or kind=p_data->>'kind') and (not coalesce((p_data->>'active')::boolean,false) or active) order by name,id limit 25 offset v_page*25)x),'[]');
 elsif p_action='contact-create' then
  if length(trim(p_data->>'name')) not between 1 and 100 or length(coalesce(p_data->>'description',''))>2000 then raise exception 'Invalid contact details';end if;
  insert into contacts(id,guild_id,name,kind,description) values(p_id,p_guild,p_data->>'name',p_data->>'kind',coalesce(p_data->>'description','')) on conflict(id) do nothing;
  select * into c from contacts where guild_id=p_guild and id=p_id;if not found then raise exception 'Contact identity conflict';end if;result:=to_jsonb(c);
 elsif p_action like 'contact-%' then
  select * into c from contacts where guild_id=p_guild and id=p_id for update;if not found then raise exception 'Contact not found';end if;
  if p_action='contact-get' then return to_jsonb(c)||jsonb_build_object('members',coalesce((select jsonb_agg(member_id) from contact_discord_members where guild_id=p_guild and contact_id=c.id),'[]'),'contacts',coalesce((select jsonb_agg(contact_id) from contact_members where group_id=c.id),'[]'));end if;
  if p_data ? 'revision' and c.revision<>(p_data->>'revision')::integer then raise exception 'Contact changed; reopen the editor';end if;
  if p_action='contact-edit' then
   if length(trim(p_data->>'name')) not between 1 and 100 or length(coalesce(p_data->>'description',''))>2000 then raise exception 'Invalid contact details';end if;
   update contacts set name=p_data->>'name',description=coalesce(p_data->>'description','') where id=c.id;
  elsif p_action='contact-thread' then update contacts set forum_thread_id=p_data->>'thread' where id=c.id;
  elsif p_action='contact-archive' then update contacts set active=false where id=c.id;
  elsif p_action in('contact-link','contact-unlink') then
   if p_action='contact-link' then insert into contact_discord_members values(c.id,p_guild,p_data->>'member') on conflict do nothing;else delete from contact_discord_members where contact_id=c.id and guild_id=p_guild and member_id=p_data->>'member';end if;
  elsif p_action='contact-group' then
   ids:=array(select jsonb_array_elements_text(p_data->'contacts')::uuid);
   if c.kind<>'GROUP' or cardinality(ids)>100 or exists(select 1 from unnest(ids) x where not exists(select 1 from contacts where guild_id=p_guild and id=x and kind='CONTACT' and active)) then raise exception 'Select active individual contacts in this server';end if;
   delete from contact_members where group_id=c.id;insert into contact_members select c.id,x from(select distinct unnest(ids) x)s;
  else raise exception 'Unknown contact action';end if;
  update contacts set revision=revision+1,updated_at=now() where id=c.id returning * into c;result:=to_jsonb(c);
 elsif p_action in('reports','pending') then return coalesce((select jsonb_agg(to_jsonb(x)) from(select * from intel_reports where guild_id=p_guild and (p_action='reports' or delivery_status in('AT_HQ','PUBLISHED')) order by created_at,id limit 25 offset v_page*25)x),'[]');
 elsif p_action like 'report-%' then
  select * into r from intel_reports where guild_id=p_guild and id=p_id for update;if not found then raise exception 'Report not found';end if;
  if p_action='report-get' then return to_jsonb(r);end if;
  if p_action='report-hq' then
   if r.delivery_status='CAPTURED' then update intel_reports set delivery_status='AT_HQ',deliverer_id=p_actor,hq_delivered_at=now() where id=r.id;end if;
  elsif p_action='report-links' then
   ids:=array(select jsonb_array_elements_text(p_data->'ids')::uuid);
   if cardinality(ids)>100 or exists(select 1 from unnest(ids) x where not exists(select 1 from contacts where guild_id=p_guild and id=x and active)) then raise exception 'Invalid contact references';end if;
   update intel_reports set linked_contact_ids=array(select id from contacts where id=any(ids) and kind='CONTACT'),linked_group_ids=array(select id from contacts where id=any(ids) and kind='GROUP') where id=r.id;
  elsif p_action='report-classify' then
   if r.delivery_status='CAPTURED' then raise exception 'Deliver this report to HQ first';end if;
   -- Existing publications retain their historical classification.
   if r.delivery_status='AT_HQ' then update intel_reports set topic=p_data->>'topic' where id=r.id;end if;
  elsif p_action='report-published' then
   if r.delivery_status='CAPTURED' or not exists(select 1 from discord_deliveries where guild_id=p_guild and delivery_key='report:'||r.id and state='SENT') then raise exception 'Publication receipt is required';end if;
   update intel_reports set delivery_status='PUBLISHED',published_at=coalesce(published_at,now()) where id=r.id;
  elsif p_action='report-source' then update intel_reports set source_message_id=p_data->>'message' where id=r.id and source_message_id is null;
  elsif p_action='report-contacts' then
   if r.delivery_status='CAPTURED' then return '[]';end if;
   return coalesce((select jsonb_agg(to_jsonb(x)) from(select distinct ct.* from contacts ct where ct.guild_id=p_guild and ct.active and ct.kind='CONTACT' and (ct.id=any(r.linked_contact_ids) or ct.id in(select cm.contact_id from contact_members cm join contacts cg on cg.id=cm.group_id where cg.guild_id=p_guild and cg.active and cg.id=any(r.linked_group_ids))))x),'[]');
  else raise exception 'Unknown report action';end if;
  select to_jsonb(x) into result from intel_reports x where id=r.id;
 elsif p_action='delivery-get' then return (select to_jsonb(x) from discord_deliveries x where guild_id=p_guild and delivery_key=p_data->>'key');
 elsif p_action='delivery-claim' then
  insert into discord_deliveries(guild_id,delivery_key,channel_id) values(p_guild,p_data->>'key',p_data->>'channel') on conflict do nothing;
  select * into d from discord_deliveries where guild_id=p_guild and delivery_key=p_data->>'key' for update;
  if d.state<>'SENT' and d.channel_id<>p_data->>'channel' then raise exception 'Delivery destination changed; recover the original receipt first';end if;
  result:=to_jsonb(d)||jsonb_build_object('claimed',d.state='READY');
  if d.state='READY' then update discord_deliveries set state='SENDING',attempted_at=now() where guild_id=p_guild and delivery_key=d.delivery_key;end if;return result;
 elsif p_action='delivery-complete' then
  update discord_deliveries set state='SENT',message_id=p_data->>'message' where guild_id=p_guild and delivery_key=p_data->>'key' and (message_id is null or message_id=p_data->>'message') returning * into d;
  if not found then raise exception 'Delivery receipt conflict';end if;return to_jsonb(d);
 else raise exception 'Unknown intelligence action';end if;
 insert into audit_events(guild_id,actor_id,subject_id,event_type,detail) values(p_guild,p_actor,p_id::text,'INTEL_'||upper(p_action),jsonb_build_object('id',p_id));return result;
end $$;
do $$ declare t text;begin foreach t in array array['intel_topics','contact_discord_members','discord_deliveries','contact_members','contact_report_forwards'] loop execute format('alter table %I enable row level security',t);execute format('grant select,insert,update,delete on %I to service_role',t);end loop;end $$;
revoke all on function codex_intelligence(text,text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function codex_intelligence(text,text,text,uuid,jsonb) to service_role;
