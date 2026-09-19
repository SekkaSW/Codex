-- Optional guild features preserve enabled behavior for every existing configuration.
alter table server_modules drop constraint server_modules_module_key_check;
alter table server_modules add constraint server_modules_module_key_check check(module_key in ('briefings','patrols','supply','atlas','intelligence','trailmarks'));
insert into server_modules(guild_id,module_key,enabled) select guild_id,key,true from server_config cross join (values('intelligence'),('trailmarks')) as feature(key) on conflict do nothing;

create function codex_require_feature(p_guild text,p_feature text) returns void language plpgsql set search_path=public as $$begin
 if exists(select 1 from server_modules where guild_id=p_guild and module_key=p_feature and not enabled) then
  if p_feature='trailmarks' then raise exception 'Trailmarks are not enabled for this group.';end if;
  raise exception 'Intelligence is not enabled for this group.';
 end if;
end $$;
revoke all on function codex_require_feature(text,text) from public,anon,authenticated;
grant execute on function codex_require_feature(text,text) to service_role;

-- Amend current RPC bodies (including migration 011 fixes) without changing signatures.
-- Shared delivery receipts are also used by Funds/Briefings/workflows, so remain available.
do $$ declare target text; definition text; guard text;begin
 foreach target in array array['codex_intelligence(text,text,text,uuid,jsonb)','codex_trailmarks(text,text,text,uuid,jsonb)','codex_bridge(text,text,text,uuid,jsonb)','codex_optional(text,text,text,text,uuid,jsonb)','codex_atlas(text,text,text,uuid,jsonb)'] loop
  definition:=pg_get_functiondef(target::regprocedure);
  guard:=case
   when target like 'codex_intelligence%' then 'if p_action not in(''delivery-claim'',''delivery-complete'',''delivery-get'') then perform codex_require_feature(p_guild,''intelligence'');end if;'
   when target like 'codex_trailmarks%' then 'perform codex_require_feature(p_guild,''trailmarks'');'
   when target like 'codex_bridge%' then 'perform codex_require_feature(p_guild,''intelligence''); if p_action=''deliver'' then perform codex_require_feature((select remote_guild_id from bridge_destinations where guild_id=p_guild and id=p_id),''intelligence'');end if;'
   when target like 'codex_optional%' then 'if p_system=''patrol'' then perform codex_require_feature(p_guild,''trailmarks'');end if;'
   else 'if p_action in(''grant'',''heartbeat'') then perform codex_require_feature(p_guild,''trailmarks'');end if;' end;
  if definition !~* '\mbegin\M' then raise exception 'Unexpected RPC body: %',target;end if;
  execute regexp_replace(definition,'\mbegin\M','begin '||guard,'i');
 end loop;
 foreach target in array array['request_atlas_trailmark_access(text,text,uuid,uuid)','submit_atlas_trailmark_drop(text,text,uuid,uuid,jsonb)','claim_pending_atlas_trailmark_access_requests(text)','claim_pending_atlas_trailmark_drops(text)','record_atlas_trailmark_visit(text,text,uuid,uuid)'] loop
  definition:=pg_get_functiondef(target::regprocedure);
  execute regexp_replace(definition,'\mbegin\M','begin perform codex_require_feature(p_guild_id,''trailmarks'');','i');
 end loop;
end $$;

-- Exists before server_config on first confirmation, so no FK to a not-yet-saved group.
-- This is a creation receipt, not a live duty assignment; duty_roles remains authoritative.
create table managed_duty_creations(
 guild_id text not null, id uuid not null, name text not null check(length(trim(name)) between 1 and 100),
 attempt uuid not null default gen_random_uuid(), role_id text, actor_id text not null, audited boolean not null default false, created_at timestamptz not null default now(),
 primary key(guild_id,id), unique(guild_id,role_id)
);
create unique index managed_duty_name on managed_duty_creations(guild_id,lower(name));
alter table managed_duty_creations enable row level security;
revoke all on managed_duty_creations from public,anon,authenticated;
grant select,insert,update,delete on managed_duty_creations to service_role;
create function codex_managed_duty(p_guild text,p_id uuid,p_action text,p_actor text,p_data jsonb default '{}') returns jsonb language plpgsql set search_path=public as $$
declare r managed_duty_creations; fresh boolean:=false;begin
 perform pg_advisory_xact_lock(hashtextextended(p_guild,0));
 if p_action='reserve' then
  select * into r from managed_duty_creations where guild_id=p_guild and (id=p_id or lower(name)=lower(trim(p_data->>'name'))) for update;
  if not found then insert into managed_duty_creations(guild_id,id,name,actor_id) values(p_guild,p_id,trim(p_data->>'name'),p_actor) returning * into r;fresh:=true;end if;
 elsif p_action='complete' then
  select * into r from managed_duty_creations where guild_id=p_guild and id=p_id for update;
  if not found or r.attempt::text is distinct from p_data->>'attempt' or coalesce(p_data->>'roleId','') !~ '^[0-9]+$' then raise exception 'Duty creation receipt does not match';end if;
  if r.role_id is not null and r.role_id<>p_data->>'roleId' then raise exception 'Duty already has a stored role';end if;
  if r.role_id is null then
   update managed_duty_creations set role_id=p_data->>'roleId' where guild_id=p_guild and id=p_id returning * into r;

  end if;
  if not r.audited and exists(select 1 from server_config where guild_id=p_guild) then
   insert into audit_events(guild_id,actor_id,subject_id,event_type,detail) values(p_guild,r.actor_id,r.role_id,'MANAGED_DUTY_ROLE_CREATED',jsonb_build_object('name',r.name,'roleId',r.role_id,'attempt',r.attempt));
   update managed_duty_creations set audited=true where guild_id=p_guild and id=r.id returning * into r;
  end if;
 else raise exception 'Unknown duty creation action';end if;
 return to_jsonb(r)||jsonb_build_object('fresh',fresh);
end $$;
revoke all on function codex_managed_duty(text,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function codex_managed_duty(text,uuid,text,text,jsonb) to service_role;

-- First-time role receipts predate the configuration row; flush their audit in its transaction.
create function codex_audit_initial_duties() returns trigger language plpgsql set search_path=public as $$begin
 insert into audit_events(guild_id,actor_id,subject_id,event_type,detail)
 select guild_id,actor_id,role_id,'MANAGED_DUTY_ROLE_CREATED',jsonb_build_object('name',name,'roleId',role_id,'attempt',attempt) from managed_duty_creations where guild_id=new.guild_id and role_id is not null and not audited;
 update managed_duty_creations set audited=true where guild_id=new.guild_id and role_id is not null and not audited;
 return new;
end $$;
revoke all on function codex_audit_initial_duties() from public,anon,authenticated;
grant execute on function codex_audit_initial_duties() to service_role;
create trigger initial_duty_audit after insert on server_config for each row execute function codex_audit_initial_duties();
