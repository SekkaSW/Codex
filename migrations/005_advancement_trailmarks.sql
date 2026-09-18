-- Durable advancement decisions and Trailmark access desired state.
create table advancement_settings (
 guild_id text primary key references server_config on delete cascade,
 voter_tier permission_tier not null default 'LEVEL_1', minimum_yes integer not null default 1 check(minimum_yes between 1 and 10000)
);
create table advancement_cases (
 id uuid primary key default gen_random_uuid(), guild_id text not null references server_config,
 candidate_id text not null, from_rank_id uuid not null, to_rank_id uuid not null,
 initiated_by text not null, status text not null default 'OPEN' check(status in('OPEN','CLOSED','APPROVED','DENIED')),
 snapshot jsonb not null, opened_at timestamptz not null default now(), closed_at timestamptz,
 decided_by text, decided_at timestamptz, reason text, revision integer not null default 0,
 foreign key(guild_id,candidate_id) references members(guild_id,discord_member_id)
);
create unique index advancement_one_pending on advancement_cases(guild_id,candidate_id) where status in('OPEN','CLOSED');
create table advancement_ballots (
 case_id uuid references advancement_cases, guild_id text not null references server_config,
 voter_id text not null, approve boolean not null, created_at timestamptz not null default now(), primary key(case_id,voter_id)
);
create function codex_advancement(p_guild text,p_action text,p_actor text,p_id uuid default null,p_data jsonb default '{}') returns jsonb language plpgsql as $$
declare c advancement_cases%rowtype; m members%rowtype; result jsonb; settings jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_guild,0));
 if p_action='settings' then return coalesce((select to_jsonb(s) from advancement_settings s where guild_id=p_guild),jsonb_build_object('voter_tier','LEVEL_1','minimum_yes',1)); end if;
 if p_action='list' then
  return coalesce((select jsonb_agg(x) from (select a.*, (select count(*) from advancement_ballots b where b.case_id=a.id and b.approve) as yes,(select count(*) from advancement_ballots b where b.case_id=a.id and not b.approve) as no from advancement_cases a where guild_id=p_guild order by opened_at desc,id limit 25 offset greatest(0,coalesce((p_data->>'page')::int,0))*25) x),'[]');
 end if;
 if p_action='setup' then
  insert into advancement_settings values(p_guild,(p_data->>'voter_tier')::permission_tier,(p_data->>'minimum_yes')::int) on conflict(guild_id) do update set voter_tier=excluded.voter_tier,minimum_yes=excluded.minimum_yes;
  result:=p_data;
 elsif p_action='open' then
  select * into m from members where guild_id=p_guild and discord_member_id=p_data->>'candidate_id';
  if not found or m.status<>'ACTIVE' or not exists(select 1 from rank_progression where guild_id=p_guild and from_rank_id=m.rank_id and to_rank_id=(p_data->>'to_rank_id')::uuid) then raise exception 'Candidate is not eligible for this configured edge'; end if;
  settings:=codex_advancement(p_guild,'settings',p_actor);
  insert into advancement_cases(guild_id,candidate_id,from_rank_id,to_rank_id,initiated_by,snapshot)
  values(p_guild,m.discord_member_id,m.rank_id,(p_data->>'to_rank_id')::uuid,p_actor,jsonb_build_object('organization',codex_organization(p_guild),'settings',settings)) returning * into c;
  result:=to_jsonb(c);
 else
  select * into c from advancement_cases where guild_id=p_guild and id=p_id for update;
  if not found then raise exception 'Advancement case not found in this guild'; end if;
  if p_action='get' then return to_jsonb(c)||jsonb_build_object('yes',(select count(*) from advancement_ballots where case_id=c.id and approve),'no',(select count(*) from advancement_ballots where case_id=c.id and not approve)); end if;
  if p_data ? 'revision' and (p_data->>'revision')::integer<>c.revision then raise exception 'Case changed; refresh status before deciding'; end if;
  if p_action='vote' then
   if c.status<>'OPEN' then raise exception 'Ballot is closed'; end if;
   if c.candidate_id=p_actor then raise exception 'Candidates cannot vote on their own advancement'; end if;
   insert into advancement_ballots values(c.id,p_guild,p_actor,(p_data->>'approve')::boolean,now());
  elsif p_action='close' then
   if c.status='CLOSED' then return to_jsonb(c); end if;
   if c.status<>'OPEN' then raise exception 'Case is already decided'; end if;
   update advancement_cases set status='CLOSED',closed_at=now(),revision=revision+1 where id=c.id returning * into c;
  elsif p_action='deny' then
   if c.status='DENIED' then return to_jsonb(c); end if;
   if c.status not in('OPEN','CLOSED') then raise exception 'Case is already decided'; end if;
   update advancement_cases set status='DENIED',closed_at=coalesce(closed_at,now()),decided_by=p_actor,decided_at=now(),reason=p_data->>'reason',revision=revision+1 where id=c.id returning * into c;
  else raise exception 'Unknown advancement action'; end if;
  result:=to_jsonb(c);
 end if;
 insert into audit_events(guild_id,actor_id,subject_id,event_type,detail) values(p_guild,p_actor,coalesce(c.candidate_id,p_guild),'ADVANCEMENT_'||upper(p_action),jsonb_build_object('case',c.id,'data',p_data));
 return result;
end $$;

create function codex_approve_advancement(p_guild text,p_case uuid,p_revision integer,p_before_version integer,p_member jsonb,p_actor text,p_reason text,p_operation uuid) returns void language plpgsql as $$
declare c advancement_cases%rowtype; yes_votes integer; no_votes integer;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_guild,0));
 select * into c from advancement_cases where id=p_case and guild_id=p_guild for update;
 if not found then raise exception 'Advancement case not found'; end if;
 if c.status='APPROVED' then return; end if;
 if c.status<>'CLOSED' or c.revision<>p_revision then raise exception 'Close the ballot and refresh status before approving'; end if;
 if p_member->>'guildId'<>p_guild or p_member->>'memberId'<>c.candidate_id or (p_member->>'rankId')::uuid<>c.to_rank_id or p_member->>'status'<>'ACTIVE' then raise exception 'Invalid advancement member state'; end if;
 if not exists(select 1 from members where guild_id=p_guild and discord_member_id=c.candidate_id and status='ACTIVE' and rank_id=c.from_rank_id) then raise exception 'Candidate state changed; deny this case and open a new one'; end if;
 select count(*) filter(where approve),count(*) filter(where not approve) into yes_votes,no_votes from advancement_ballots where case_id=c.id;
 if yes_votes<(c.snapshot->'settings'->>'minimum_yes')::int or yes_votes<=no_votes then raise exception 'Ballot requires its configured minimum approvals and a positive majority'; end if;
 perform codex_commit_member(p_before_version,p_member,p_actor,'MEMBER_PROMOTED',p_reason,p_operation);
 update advancement_cases set status='APPROVED',decided_by=p_actor,decided_at=now(),reason=p_reason,revision=revision+1 where id=c.id;
 insert into audit_events(guild_id,actor_id,subject_id,event_type,detail) values(p_guild,p_actor,c.candidate_id,'ADVANCEMENT_APPROVED',jsonb_build_object('case',c.id,'operation',p_operation));
end $$;

alter table trailmarks add column description text not null default '' check(length(description)<=2000);
alter table trailmarks add column access_tier permission_tier not null default 'BASELINE';
alter table trailmarks add column session_minutes integer not null default 60 check(session_minutes between 1 and 10080);
alter table trailmarks add column coordinates jsonb;
alter table trailmarks add column revision integer not null default 0;
alter table trailmarks add column created_at timestamptz not null default now();
alter table trailmarks add column updated_at timestamptz not null default now();
alter table trailmark_sessions add column state text not null default 'ACTIVE' check(state in('PENDING','ACTIVE','REVOKING','CLOSED'));
update trailmark_sessions set state='CLOSED' where not active;
alter table intel_reports add column confidential boolean not null default false;
alter table intel_reports add column author_id text;
alter table intel_reports add column adapter_metadata jsonb not null default '{}';

create function codex_trailmarks(p_guild text,p_action text,p_actor text,p_id uuid default null,p_data jsonb default '{}') returns jsonb language plpgsql as $$
declare t trailmarks%rowtype; s trailmark_sessions%rowtype; result jsonb; report_id uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_guild,0));
 if p_action='list' then return coalesce((select jsonb_agg(x) from (select * from trailmarks where guild_id=p_guild order by created_at,id limit 25 offset greatest(0,coalesce((p_data->>'page')::int,0))*25) x),'[]'); end if;
 if p_action='sessions' then return coalesce((select jsonb_agg(x) from (select * from trailmark_sessions where guild_id=p_guild and state<>'CLOSED' and (coalesce((p_data->>'all')::boolean,false) or discord_member_id=p_actor) order by expires_at,id limit 100) x),'[]'); end if;
 if p_action='pending' then return coalesce((select jsonb_agg(x) from (select * from trailmark_sessions where guild_id=p_guild and (state in('PENDING','REVOKING') or (state='ACTIVE' and expires_at<=now())) order by case when state='REVOKING' then 0 else 1 end,expires_at,id limit 100) x),'[]'); end if;
 if p_action='create' then
  if coalesce(length(trim(p_data->>'name')),0) not between 1 and 100 then raise exception 'Trailmark name must contain 1-100 characters'; end if;
  p_id:=coalesce(p_id,gen_random_uuid());
  insert into trailmarks(id,guild_id,slug,name,channel_id,description,access_tier,session_minutes) values(p_id,p_guild,p_id::text,p_data->>'name','pending:'||p_id,coalesce(p_data->>'description',''),coalesce((p_data->>'access_tier')::permission_tier,'BASELINE'),coalesce((p_data->>'session_minutes')::int,60)) returning * into t;
 elsif p_action in('session-active','session-closed','session-revoke') then
  select * into s from trailmark_sessions where id=p_id and guild_id=p_guild for update;
  if not found then raise exception 'Session not found'; end if;
  if p_action='session-active' and (s.state not in('PENDING','ACTIVE') or s.expires_at<=now() or not exists(select 1 from trailmarks where id=s.trailmark_id and guild_id=p_guild and active)) then raise exception 'Session no longer eligible for activation'; end if;
  update trailmark_sessions set state=case p_action when 'session-active' then 'ACTIVE' when 'session-revoke' then 'REVOKING' else 'CLOSED' end,active=(p_action='session-active') where id=s.id returning * into s;
  result:=to_jsonb(s);
 elsif p_action='leave' then
  update trailmark_sessions set state='REVOKING',active=false where guild_id=p_guild and discord_member_id=p_actor and state in('PENDING','ACTIVE');result:='{}';
 else
  select * into t from trailmarks where guild_id=p_guild and id=p_id for update;
  if not found then raise exception 'Trailmark not found in this guild'; end if;
  if p_action='get' then return to_jsonb(t); end if;
  if p_data ? 'revision' and (p_data->>'revision')::int<>t.revision then raise exception 'Trailmark changed; reopen its editor'; end if;
  if p_action='edit' then
   if length(trim(p_data->>'name')) not between 1 and 100 then raise exception 'Trailmark name must contain 1-100 characters'; end if;
   update trailmarks set name=p_data->>'name',description=coalesce(p_data->>'description',description),access_tier=coalesce((p_data->>'access_tier')::permission_tier,access_tier),session_minutes=coalesce((p_data->>'session_minutes')::int,session_minutes),revision=revision+1,updated_at=now() where id=t.id returning * into t;
  elsif p_action='hq' then
   if not t.active then raise exception 'Headquarters must be active'; end if;
   update trailmarks set is_headquarters=false where guild_id=p_guild and is_headquarters;
   update trailmarks set is_headquarters=true,revision=revision+1 where id=t.id returning * into t;
  elsif p_action='deactivate' then
   update trailmarks set active=false,is_headquarters=false,revision=revision+1 where id=t.id returning * into t;
   update trailmark_sessions set state='REVOKING',active=false where guild_id=p_guild and trailmark_id=t.id and state in('PENDING','ACTIVE');
  elsif p_action='atlas' then
   update trailmarks set atlas_id=p_data->>'atlas_id',coordinates=p_data->'coordinates',revision=revision+1 where id=t.id returning * into t;
  elsif p_action='channel' then
   update trailmarks set channel_id=p_data->>'channel_id' where id=t.id returning * into t;
   insert into managed_resources(guild_id,resource_key,discord_id,resource_kind,owner_id) values(p_guild,'TRAILMARK:'||t.id,t.channel_id,'CHANNEL',t.id::text) on conflict(guild_id,resource_key) do update set discord_id=excluded.discord_id;
   update trailmark_sessions set state='PENDING' where guild_id=p_guild and trailmark_id=t.id and state='ACTIVE';
  elsif p_action='access' then
   if not t.active then raise exception 'Trailmark is inactive'; end if;
   select * into s from trailmark_sessions where guild_id=p_guild and discord_member_id=p_actor and trailmark_id=t.id and active and expires_at>now();
   if found then return to_jsonb(s); end if;
   update trailmark_sessions set state='REVOKING',active=false where guild_id=p_guild and discord_member_id=p_actor and state in('PENDING','ACTIVE');
   insert into trailmark_sessions(id,guild_id,trailmark_id,discord_member_id,expires_at,active,state) values(gen_random_uuid(),p_guild,t.id,p_actor,now()+make_interval(mins=>t.session_minutes),true,'PENDING') returning * into s;result:=to_jsonb(s);
  elsif p_action='report' then
   if not t.active then raise exception 'Trailmark is inactive'; end if;
   if length(trim(p_data->>'body')) not between 1 and 4000 then raise exception 'Report must contain 1-4000 characters'; end if;
   report_id:=(p_data->>'id')::uuid;
   if exists(select 1 from intel_reports where id=report_id and (guild_id<>p_guild or reporter_id<>p_actor)) then raise exception 'Report identity belongs to another author or guild'; end if;
   insert into intel_reports(id,guild_id,body,source,reporter_id,author_id,source_trailmark_id,source_channel_id,delivery_status,created_at,confidential,adapter_metadata)
   values(report_id,p_guild,p_data->>'body','codex',p_actor,p_actor,t.id,t.channel_id,case when t.is_headquarters then 'AT_HQ'::report_delivery_status else 'CAPTURED'::report_delivery_status end,now(),position(lower((select confidentiality_marker from server_config where guild_id=p_guild)) in lower(p_data->>'body'))>0,jsonb_build_object('interactionId',p_data->>'interaction_id')) on conflict(id) do nothing;
   result:=jsonb_build_object('id',report_id,'status',case when t.is_headquarters then 'AT_HQ' else 'CAPTURED' end);
  else raise exception 'Unknown Trailmark action'; end if;
 end if;
 result:=coalesce(result,to_jsonb(t));
 insert into audit_events(guild_id,actor_id,subject_id,event_type,detail) values(p_guild,p_actor,coalesce(p_id::text,p_actor),'TRAILMARK_'||upper(p_action),jsonb_build_object('id',p_id));
 return result;
end $$;
do $$ declare t text; f record; begin
 foreach t in array array['advancement_settings','advancement_cases','advancement_ballots','trailmarks','trailmark_sessions'] loop execute format('alter table %I enable row level security',t);execute format('grant select,insert,update,delete on %I to service_role',t); end loop;
 for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname in('codex_advancement','codex_approve_advancement','codex_trailmarks') loop execute format('revoke all on function %s from public,anon,authenticated',f.signature);execute format('grant execute on function %s to service_role',f.signature);end loop;
end $$;
grant select,insert,update on intel_reports to service_role;
