create table supply_campaigns(id uuid primary key,guild_id text not null references server_config on delete cascade,title text not null,status text not null default 'OPEN' check(status in('OPEN','CLOSED','CANCELLED')),created_by text not null,created_at timestamptz not null default now());
create table supply_events(id uuid primary key,campaign_id uuid not null references supply_campaigns on delete cascade,guild_id text not null references server_config on delete cascade,actor_id text not null,recipient_id text,quantity numeric not null check(quantity<>0),kind text not null check(kind in('LOG','REDISTRIBUTE','UNDO')),reverses uuid references supply_events,created_at timestamptz not null default now(),unique(reverses));
create table briefings(id uuid primary key,guild_id text not null references server_config on delete cascade,actor_id text not null,title text not null,body text not null,created_at timestamptz not null default now());
create table patrol_suggestions(id uuid primary key,guild_id text not null references server_config on delete cascade,actor_id text not null,trailmark_id uuid references trailmarks on delete set null,reason text not null,status text not null default 'OPEN' check(status in('OPEN','RESOLVED')),created_at timestamptz not null default now());
create or replace function codex_optional(p_guild text,p_system text,p_action text,p_actor text,p_id uuid default null,p_data jsonb default '{}') returns jsonb language plpgsql set search_path=public as $$
declare result jsonb;c supply_campaigns;e supply_events;stock numeric;q numeric;page integer:=greatest(0,coalesce((p_data->>'page')::integer,0));begin
 perform pg_advisory_xact_lock(hashtext(p_guild));
 if p_system<>'reference' and not exists(select 1 from server_modules where guild_id=p_guild and module_key=case when p_system='briefing' then 'briefings' when p_system='patrol' then 'patrols' else p_system end and enabled) then raise exception 'Optional module is disabled';end if;
 if p_system='supply' then
  if p_action='list' then return coalesce((select jsonb_agg(to_jsonb(x)) from(select * from supply_campaigns where guild_id=p_guild order by created_at desc,id limit 25 offset page*25)x),'[]');end if;
  if p_action='create' then if length(trim(p_data->>'title')) not between 1 and 200 then raise exception 'Supply campaign title required';end if;insert into supply_campaigns values(p_id,p_guild,p_data->>'title','OPEN',p_actor,now()) on conflict(id) do nothing;end if;
  select * into c from supply_campaigns where guild_id=p_guild and id=p_id for update;if not found then raise exception 'Supply campaign not found';end if;
  select coalesce(sum(quantity),0) into stock from supply_events where campaign_id=c.id;
  if p_action in('log','redistribute','undo-last') then
   if c.status<>'OPEN' then raise exception 'Supply campaign is not open';end if;
   if exists(select 1 from supply_events where id=(p_data->>'operation')::uuid and campaign_id=c.id) then return to_jsonb(c)||jsonb_build_object('stock',stock);end if;
   if p_action='undo-last' then
    select * into e from supply_events x where campaign_id=c.id and actor_id=p_actor and kind='LOG' and not exists(select 1 from supply_events y where y.reverses=x.id) order by created_at desc,id desc limit 1;
    if not found or stock<e.quantity then raise exception 'No unallocated contribution can be undone';end if;
    insert into supply_events values((p_data->>'operation')::uuid,c.id,p_guild,p_actor,null,-e.quantity,'UNDO',e.id,now());
   else
    q:=(p_data->>'quantity')::numeric;if q is null or q<=0 or q>1000000000 or q::text in('NaN','Infinity','-Infinity') then raise exception 'Quantity must be positive and bounded';end if;
    if p_action='redistribute' then if stock<q then raise exception 'Insufficient unallocated stock';end if;if not exists(select 1 from members where guild_id=p_guild and discord_member_id=p_data->>'recipient' and status='ACTIVE') then raise exception 'Recipient must be a synchronized active member';end if;q:=-q;end if;
    insert into supply_events values((p_data->>'operation')::uuid,c.id,p_guild,p_actor,p_data->>'recipient',q,case when p_action='log' then 'LOG' else 'REDISTRIBUTE' end,null,now());
   end if;
  elsif p_action in('close','reopen','cancel') then if c.status='CANCELLED' then raise exception 'Cancelled campaigns cannot be reopened';end if;update supply_campaigns set status=case p_action when 'close' then 'CLOSED' when 'reopen' then 'OPEN' else 'CANCELLED' end where id=c.id returning * into c;
  elsif p_action not in('create','get','status','contributors','refresh') then raise exception 'Unknown Supply action';end if;
  select coalesce(sum(quantity),0) into stock from supply_events where campaign_id=c.id;
  result:=to_jsonb(c)||jsonb_build_object('stock',stock,'contributors',coalesce((select jsonb_agg(to_jsonb(x)) from(select actor_id,sum(quantity) quantity from supply_events where campaign_id=c.id and kind in('LOG','UNDO') group by actor_id)x),'[]'),'allocations',coalesce((select jsonb_agg(to_jsonb(x)) from(select recipient_id,-sum(quantity) quantity from supply_events where campaign_id=c.id and kind='REDISTRIBUTE' group by recipient_id)x),'[]'));
 elsif p_system='briefing' then
  if p_action='settings' then return coalesce((select value from workflow_settings where guild_id=p_guild and system='briefing'),'{}');end if;
  if p_action='setup' then if length(trim(p_data->>'heading')) not between 1 and 100 then raise exception 'Briefing heading is required';end if;insert into workflow_settings values(p_guild,'briefing',p_data) on conflict(guild_id,system) do update set value=excluded.value;result:=p_data;
  elsif p_action='send' then if length(trim(p_data->>'body')) not between 1 and 3500 then raise exception 'Briefing body required';end if;insert into briefings values(p_id,p_guild,p_actor,left(p_data->>'title',200),p_data->>'body',now()) on conflict(id) do nothing;select to_jsonb(x) into result from briefings x where guild_id=p_guild and id=p_id;
  elsif p_action='list' then return coalesce((select jsonb_agg(to_jsonb(x)) from(select * from briefings where guild_id=p_guild order by created_at desc,id limit 25 offset page*25)x),'[]');
  elsif p_action='get' then return (select to_jsonb(x) from briefings x where guild_id=p_guild and id=p_id);
  else raise exception 'Unknown Briefing action';end if;
 elsif p_system='patrol' then
  if p_action='list' then return coalesce((select jsonb_agg(to_jsonb(x)) from(select * from patrol_suggestions where guild_id=p_guild order by created_at desc,id limit 25 offset page*25)x),'[]');end if;
  if p_action='suggest' then
   if not exists(select 1 from trailmarks where guild_id=p_guild and active) then raise exception 'Configure an active Trailmark first';end if;
   insert into patrol_suggestions(id,guild_id,actor_id,trailmark_id,reason) select p_id,p_guild,p_actor,t.id,'Suggested active Trailmark with the oldest recorded patrol suggestion' from trailmarks t where guild_id=p_guild and active order by (select max(created_at) from patrol_suggestions where trailmark_id=t.id) nulls first,t.name,t.id limit 1 on conflict(id) do nothing;
  elsif p_action='resolve' then update patrol_suggestions set status='RESOLVED' where guild_id=p_guild and id=p_id;
  elsif p_action<>'get' then raise exception 'Unknown Patrol action';end if;
  select to_jsonb(x) into result from patrol_suggestions x where guild_id=p_guild and id=p_id;if result is null then raise exception 'Patrol suggestion not found';end if;
 elsif p_system='reference' then
  if p_action='list' then return coalesce((select jsonb_agg(to_jsonb(x)) from(select * from reference_entries where guild_id=p_guild order by key limit 25 offset page*25)x),'[]');end if;
  if p_action='save' then
   if length(trim(p_data->>'key')) not between 1 and 100 or length(trim(p_data->>'title')) not between 1 and 200 or length(trim(p_data->>'body')) not between 1 and 4000 then raise exception 'Reference key/title/body required';end if;
   insert into reference_entries(guild_id,key,title,body) values(p_guild,p_data->>'key',p_data->>'title',p_data->>'body') on conflict(guild_id,key) do update set title=excluded.title,body=excluded.body,updated_at=now() returning to_jsonb(reference_entries.*) into result;
  elsif p_action='get' then select to_jsonb(x) into result from reference_entries x where guild_id=p_guild and id=p_id;if result is null then raise exception 'Reference entry not found';end if;
  else raise exception 'Unknown Reference action';end if;
 else raise exception 'Unknown optional system';end if;
 insert into audit_events(guild_id,actor_id,subject_id,event_type,detail) values(p_guild,p_actor,p_id::text,upper(p_system)||'_'||upper(p_action),jsonb_build_object('id',p_id));return result;
end $$;
do $$ declare t text;begin foreach t in array array['supply_campaigns','supply_events','briefings','patrol_suggestions','reference_entries'] loop execute format('alter table %I enable row level security',t);execute format('grant select,insert,update,delete on %I to service_role',t);end loop;end $$;
revoke all on function codex_optional(text,text,text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function codex_optional(text,text,text,text,uuid,jsonb) to service_role;
