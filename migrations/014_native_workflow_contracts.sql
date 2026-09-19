-- Native workflow fields are additive. Existing rows retain their generalized behavior.
alter table trailmarks add column detail jsonb not null default '{}';
alter table fund_ledger add column member_id text;
alter table votes add column channel_id text,add column context text not null default '';
alter table mentorships add column seeking text not null default 'Mentor',add column note text,add column proposed_by text;
create table native_forms(guild_id text not null references server_config on delete cascade,id uuid not null,owner_id text not null,system text not null,input jsonb not null,expires_at timestamptz not null default now()+interval '30 minutes',result jsonb,primary key(guild_id,id));
create table reference_archive(guild_id text not null references server_config on delete cascade,id uuid not null,actor_id text not null,title text not null,metadata jsonb not null,body text not null,created_at timestamptz not null default now(),primary key(guild_id,id));
alter table briefings add column audience text not null default 'apprentice_plus' check(audience in('apprentice_plus','ranger_plus','marshal_plus','captain_plus','individual')),add column recipient_id text,add column kind text not null default 'ic' check(kind in('ic','ooc'));
create table briefing_preferences(guild_id text not null references server_config on delete cascade,member_id text not null,dm_enabled boolean not null default true,primary key(guild_id,member_id));
create table briefing_reads(guild_id text not null references server_config on delete cascade,member_id text not null,briefing_id uuid not null references briefings on delete cascade,read_at timestamptz not null default now(),primary key(guild_id,member_id,briefing_id));
alter table advancement_ballots alter column approve drop not null;
create table promotion_progress(guild_id text not null references server_config on delete cascade,member_id text not null,progress text not null check(progress in('field_trial','on_hold','clear')),actor_id text not null,updated_at timestamptz not null default now(),primary key(guild_id,member_id),foreign key(guild_id,member_id) references members(guild_id,discord_member_id));
create function codex_native(p_guild text,p_action text,p_actor text,p_id uuid default null,p_data jsonb default '{}') returns jsonb language plpgsql set search_path=public as $$
declare f native_forms;result jsonb;m mentorships;v votes;entry jsonb;requested text;begin
 perform pg_advisory_xact_lock(hashtextextended(p_guild,0));
 if not exists(select 1 from server_config where guild_id=p_guild) then raise exception 'Server not configured';end if;
 if p_action='invite-claim' then
  insert into native_forms(guild_id,id,owner_id,system,input) values(p_guild,p_id,p_actor,'recruit-invite',p_data) on conflict do nothing;
  if found then return jsonb_build_object('claimed',true);end if;
  select * into f from native_forms where guild_id=p_guild and id=p_id;if f.owner_id<>p_actor or f.system<>'recruit-invite' or f.input<>p_data then raise exception 'Invite operation conflict';end if;
  return jsonb_build_object('claimed',false,'result',f.result);
 elsif p_action='promotion-progress' then
  if coalesce(p_data->>'progress','') not in('field_trial','on_hold','clear') then raise exception 'Choose a promotion progress status';end if;
  insert into promotion_progress values(p_guild,p_data->>'candidate',p_data->>'progress',p_actor,now()) on conflict(guild_id,member_id) do update set progress=excluded.progress,actor_id=excluded.actor_id,updated_at=now();result:=p_data;
 elsif p_action='promotion-progress-list' then return coalesce((select jsonb_agg(to_jsonb(p)) from promotion_progress p where guild_id=p_guild),'[]');
 elsif p_action='promotion-open' then
  select * into f from native_forms where guild_id=p_guild and id=p_id;
  if found then if f.owner_id<>p_actor or f.system<>'promotion-open' or f.input<>p_data then raise exception 'Promotion operation conflict';end if;return codex_advancement(p_guild,'get',p_actor,(f.result->>'id')::uuid);end if;
  result:=codex_advancement(p_guild,'open',p_actor,null,p_data);
  update advancement_cases set reason=p_data->>'reason',snapshot=snapshot||jsonb_build_object('mentions',coalesce(p_data->'mentions','[]')) where guild_id=p_guild and id=(result->>'id')::uuid returning to_jsonb(advancement_cases.*) into result;
  insert into native_forms(guild_id,id,owner_id,system,input,result) values(p_guild,p_id,p_actor,'promotion-open',p_data,result);
 elsif p_action='promotion-ballots' then
  perform codex_advancement(p_guild,'get',p_actor,p_id);return coalesce((select jsonb_agg(jsonb_build_object('voter',voter_id,'selection',case when approve then 'Yes' when not approve then 'No' else 'Abstain' end)) from advancement_ballots where guild_id=p_guild and case_id=p_id),'[]');
 elsif p_action='promotion-abstain' then
  if not exists(select 1 from advancement_cases where guild_id=p_guild and id=p_id and status='OPEN' and candidate_id<>p_actor) then raise exception 'This ballot is closed or belongs to the candidate';end if;
  insert into advancement_ballots values(p_id,p_guild,p_actor,null,now());result:=codex_advancement(p_guild,'get',p_actor,p_id);
 elsif p_action like 'briefing-%' then
  if not exists(select 1 from server_modules where guild_id=p_guild and module_key='briefings' and enabled) then raise exception 'Briefings are disabled';end if;
  if p_action='briefing-preference' then
   if jsonb_typeof(p_data->'dm_enabled') is distinct from 'boolean' then raise exception 'Choose a DM preference';end if;
   insert into briefing_preferences values(p_guild,p_actor,(p_data->>'dm_enabled')::boolean) on conflict(guild_id,member_id) do update set dm_enabled=excluded.dm_enabled;return p_data;
  elsif p_action='briefing-send' then
   if coalesce(length(trim(p_data->>'title')),0) not between 1 and 150 or coalesce(length(trim(p_data->>'body')),0) not between 1 and 3000 or coalesce(p_data->>'audience','') not in('apprentice_plus','ranger_plus','marshal_plus','captain_plus','individual') or coalesce(p_data->>'kind','') not in('ic','ooc') then raise exception 'Invalid dispatch';end if;
   if (p_data->>'audience'='individual') is distinct from (p_data->>'recipient' is not null) then raise exception 'Individual dispatch requires exactly one recipient';end if;
   insert into briefings(id,guild_id,actor_id,title,body,audience,recipient_id,kind) values(p_id,p_guild,p_actor,p_data->>'title',p_data->>'body',p_data->>'audience',p_data->>'recipient',p_data->>'kind') on conflict do nothing;
   select to_jsonb(b) into result from briefings b where guild_id=p_guild and id=p_id and actor_id=p_actor;if result is null then raise exception 'Dispatch operation conflict';end if;
  elsif p_action='briefing-inbox' then
   return jsonb_build_object('dm_enabled',coalesce((select dm_enabled from briefing_preferences where guild_id=p_guild and member_id=p_actor),true),'dispatches',coalesce((select jsonb_agg(to_jsonb(b)) from(select b.* from briefings b where b.guild_id=p_guild and not exists(select 1 from briefing_reads r where r.guild_id=p_guild and r.member_id=p_actor and r.briefing_id=b.id) and ((b.audience='individual' and b.recipient_id=p_actor) or b.audience in(select jsonb_array_elements_text(p_data->'audiences'))) order by b.created_at,b.id limit 25)b),'[]'));
  elsif p_action='briefing-read' then
   insert into briefing_reads(guild_id,member_id,briefing_id) select p_guild,p_actor,b.id from briefings b where b.guild_id=p_guild and b.id::text in(select jsonb_array_elements_text(p_data->'ids')) on conflict do nothing;return '{}';
  else raise exception 'Unknown briefing action';end if;
 elsif p_action='patrol-locations' then
  perform codex_require_feature(p_guild,'trailmarks');
  if not exists(select 1 from server_modules where guild_id=p_guild and module_key='patrols' and enabled) then raise exception 'Patrols are disabled';end if;
  if p_data->>'assignment' is not null and not exists(select 1 from assignment_entries e join assignment_groups g on g.id=e.group_id where g.guild_id=p_guild and e.id::text=p_data->>'assignment') then raise exception 'Assignment not found in this server';end if;
  return coalesce((select jsonb_agg(to_jsonb(x)) from(select t.*,(select max(s.created_at) from trailmark_sessions s where s.guild_id=p_guild and (s.trailmark_id=t.id or s.trailmark_id::text=t.detail->>'patrol_primary')) last_visit from trailmarks t where t.guild_id=p_guild and t.active and (p_data->>'assignment' is null or t.detail->>'assignment'=p_data->>'assignment') order by last_visit nulls first,t.name,t.id limit 500)x),'[]');
 elsif p_action='form-create' then
  if length(p_data::text)>20000 then raise exception 'Form input is too long';end if;
  insert into native_forms(guild_id,id,owner_id,system,input) values(p_guild,p_id,p_actor,p_data->>'system',p_data->'input') on conflict do nothing;
  select * into f from native_forms where guild_id=p_guild and id=p_id;
  if f.owner_id<>p_actor or f.system<>p_data->>'system' then raise exception 'Form belongs to another request';end if;return to_jsonb(f);
 elsif p_action in('form-get','form-complete') then
  select * into f from native_forms where guild_id=p_guild and id=p_id for update;
  if not found or f.owner_id<>p_actor or f.expires_at<now() then raise exception 'Form is expired or belongs to another member';end if;
  if p_action='form-complete' then update native_forms set result=coalesce(native_forms.result,p_data) where guild_id=p_guild and id=p_id returning * into f;end if;return to_jsonb(f);
 elsif p_action='reference-save' then
  if coalesce(length(trim(p_data->>'body')),0) not between 1 and 12000 or coalesce(length(trim(p_data->>'title')),0) not between 1 and 150 then raise exception 'Reference title and source text required';end if;
  if p_data->'metadata'->>'supersedes' is not null and not exists(select 1 from reference_archive where guild_id=p_guild and id::text=p_data->'metadata'->>'supersedes') then raise exception 'Earlier reference not found in this server';end if;
  insert into reference_archive(guild_id,id,actor_id,title,metadata,body) values(p_guild,p_id,p_actor,p_data->>'title',p_data->'metadata',p_data->>'body') on conflict do nothing;
  select to_jsonb(x) into result from reference_archive x where guild_id=p_guild and id=p_id;
 elsif p_action='reference-get' then return (select to_jsonb(x) from reference_archive x where guild_id=p_guild and id=p_id);
 elsif p_action='topic-create' then
  perform codex_require_feature(p_guild,'intelligence');
  select * into f from native_forms where guild_id=p_guild and id=p_id;
  if found then if f.owner_id<>p_actor or f.system<>'topic-create' then raise exception 'Topic operation belongs to another request';end if;return f.result;end if;
  result:=codex_intelligence(p_guild,'topic-save',p_actor,null,p_data);
  insert into native_forms(guild_id,id,owner_id,system,input,result) values(p_guild,p_id,p_actor,'topic-create',p_data,result);
 elsif p_action='contact-assessment' then
  perform codex_require_feature(p_guild,'intelligence');if coalesce(p_data->>'assessment','') not in('good','cold','not_found','mia','archive') then raise exception 'Choose a listed assessment';end if;
  update contacts set detail=detail||jsonb_build_object('assessment',p_data->>'assessment','assessed_by',p_actor,'assessed_at',now()),revision=revision+1 where guild_id=p_guild and id=p_id and active returning to_jsonb(contacts.*) into result;if result is null then raise exception 'Active contact not found in this server';end if;
  insert into audit_events(guild_id,actor_id,subject_id,event_type,detail) values(p_guild,p_actor,p_id::text,'CONTACT_ASSESSMENT',p_data);return result;
 elsif p_action='contact-save' then
  perform codex_require_feature(p_guild,'intelligence');
  if length(coalesce(p_data->'detail','{}')::text)>12000 then raise exception 'Contact details are too long';end if;
  result:=codex_intelligence(p_guild,case when exists(select 1 from contacts where guild_id=p_guild and id=p_id) then 'contact-edit' else 'contact-create' end,p_actor,p_id,p_data);
  update contacts set detail=coalesce(p_data->'detail',detail) where guild_id=p_guild and id=p_id returning to_jsonb(contacts.*) into result;
 elsif p_action='trailmark-save' then
  perform codex_require_feature(p_guild,'trailmarks');
  if p_data->'detail'->>'assignment' is not null and not exists(select 1 from assignment_entries e join assignment_groups g on g.id=e.group_id where g.guild_id=p_guild and e.id::text=p_data->'detail'->>'assignment') then raise exception 'Assignment not found in this server';end if;
  if p_data->'detail'->>'patrol_primary' is not null and (p_data->'detail'->>'patrol_primary'=p_id::text or not exists(select 1 from trailmarks where guild_id=p_guild and id::text=p_data->'detail'->>'patrol_primary' and active)) then raise exception 'Choose another active Trailmark for shared patrol activity';end if;
  result:=codex_trailmarks(p_guild,case when exists(select 1 from trailmarks where guild_id=p_guild and id=p_id) then 'edit' else 'create' end,p_actor,p_id,p_data);
  update trailmarks set detail=coalesce(p_data->'detail',detail) where guild_id=p_guild and id=p_id returning to_jsonb(trailmarks.*) into result;
 elsif p_action='vote-open' then
  select to_jsonb(x) into result from votes x where guild_id=p_guild and id=p_id;
  if found then if result->>'opened_by'<>p_actor or result->>'title'<>p_data->>'title' then raise exception 'Vote operation conflict';end if;return codex_workflow(p_guild,'vote','get',p_actor,p_id);end if;
  if coalesce(length(p_data->>'title'),0) not between 1 and 300 or coalesce(length(p_data->>'context'),0)>1000 then raise exception 'Invalid vote question or context';end if;
  result:=codex_workflow(p_guild,'vote','open',p_actor,p_id,jsonb_set(p_data,'{title}',to_jsonb(left(p_data->>'title',200))));
  update votes set title=p_data->>'title',channel_id=p_data->>'channel',context=coalesce(p_data->>'context','') where guild_id=p_guild and id=p_id returning to_jsonb(votes.*) into result;
 elsif p_action='assignment-open' then
  select to_jsonb(x) into result from managed_assignments x where guild_id=p_guild and id=p_id;
  if found then if result->'payload'->>'created_by'<>p_actor or result->>'title'<>p_data->>'title' then raise exception 'Assignment operation conflict';end if;return result;end if;
  if p_data->>'assignment' is not null and not exists(select 1 from assignment_entries e join assignment_groups g on g.id=e.group_id where g.guild_id=p_guild and e.id::text=p_data->>'assignment') then raise exception 'Assignment not found in this server';end if;
  if p_data->>'minimum_rank' is not null and not exists(select 1 from ranks where guild_id=p_guild and id::text=p_data->>'minimum_rank') then raise exception 'Rank not found in this server';end if;
  result:=codex_workflow(p_guild,'assignment','open',p_actor,p_id,p_data);
  update managed_assignments set payload=payload||jsonb_build_object('minimum_rank',p_data->>'minimum_rank','assignment',p_data->>'assignment','objective',p_data->>'objective','details',p_data->>'details','location',p_data->>'location','timing',p_data->>'timing','created_by',p_actor) where guild_id=p_guild and id=p_id returning to_jsonb(managed_assignments.*) into result;
 elsif p_action='mentorship-preference' then
  if p_data->>'seeking' not in ('Mentor','Apprentice') then raise exception 'Choose Mentor or Apprentice';end if;
  select * into m from mentorships where guild_id=p_guild and mentee_id=p_actor and status='LOOKING';
  if not found then result:=codex_workflow(p_guild,'mentorship','looking-for',p_actor,p_id);select * into m from mentorships where guild_id=p_guild and id=p_id;end if;
  update mentorships set seeking=p_data->>'seeking',note=p_data->>'note' where guild_id=p_guild and id=m.id returning to_jsonb(mentorships.*) into result;
 elsif p_action='mentorship-pair' then
  if p_data->>'mentor'=p_data->>'mentee' or not exists(select 1 from members where guild_id=p_guild and discord_member_id=p_data->>'mentee' and status='ACTIVE') then raise exception 'Select two distinct active members';end if;
  select * into m from mentorships where guild_id=p_guild and mentee_id=p_data->>'mentee' and status in('LOOKING','PROPOSED','ACTIVE');
  if not found then insert into mentorships(id,guild_id,mentee_id,status,changed_by) values(p_id,p_guild,p_data->>'mentee','LOOKING',p_actor) returning * into m;end if;
  if m.status='ACTIVE' then if m.mentor_id=p_data->>'mentor' then return to_jsonb(m);end if;raise exception 'Member already has an active mentorship';end if;
  if m.status='PROPOSED' and m.mentor_id is distinct from p_data->>'mentor' then raise exception 'Another mentorship proposal is pending';end if;
  result:=codex_workflow(p_guild,'mentorship',case when p_data->>'assign'='true' then 'assign' else 'propose' end,p_actor,m.id,jsonb_build_object('mentor',p_data->>'mentor'));
  update mentorships set proposed_by=p_actor,note=p_data->>'reason' where guild_id=p_guild and id=m.id returning to_jsonb(mentorships.*) into result;
 elsif p_action in('mentorship-accept','mentorship-decline') then
  select * into m from mentorships where guild_id=p_guild and id=p_id;
  if not found or p_actor<>m.mentee_id or m.status<>'PROPOSED' then raise exception 'Only the recipient can answer this pending proposal';end if;
  result:=codex_workflow(p_guild,'mentorship',case when p_action='mentorship-accept' then 'assign' else 'end' end,p_actor,p_id,jsonb_build_object('mentor',m.mentor_id));
 else raise exception 'Unknown native workflow action';end if;
 insert into audit_events(guild_id,actor_id,subject_id,event_type,detail) values(p_guild,p_actor,p_id::text,upper(p_action),jsonb_build_object('id',p_id));return result;
end $$;
do $$ declare t text;begin foreach t in array array['native_forms','reference_archive','briefing_preferences','briefing_reads','promotion_progress'] loop execute format('alter table %I enable row level security',t);execute format('revoke all on %I from public,anon,authenticated',t);execute format('grant select,insert,update,delete on %I to service_role',t);end loop;end $$;
revoke all on function codex_native(text,text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function codex_native(text,text,text,uuid,jsonb) to service_role;

-- Explicit release/reconciliation remains safe when eligibility or feature enablement is lost.
do $$ declare definition text;begin
 definition:=pg_get_functiondef('codex_trailmarks(text,text,text,uuid,jsonb)'::regprocedure);
 definition:=replace(definition,'perform codex_require_feature(p_guild,''trailmarks'');','if p_action not in(''leave'',''sessions'',''get'',''session-revoke'',''session-closed'') then perform codex_require_feature(p_guild,''trailmarks'');end if;');
 definition:=replace(definition,'not between 1 and 4000','not between 1 and 6000');execute definition;
end $$;
create or replace function codex_funds_recent(p_guild text,p_limit integer) returns jsonb language sql stable set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',id,'guildId',guild_id,'amount',amount,'kind',kind,'actorId',actor_id,'memberId',member_id,'note',note,'createdAt',created_at,'reversedEntryId',reversed_entry_id))),'[]') from(select * from fund_ledger where guild_id=p_guild order by created_at desc,id desc limit greatest(1,least(p_limit,25))) x
$$;

-- Native Strongbox retains a full 4,000-character message plus an attachment URL.
do $$ declare definition text;begin
 definition:=pg_get_functiondef('codex_workflow(text,text,text,text,uuid,jsonb)'::regprocedure);
 definition:=replace(definition,'not between 1 and 3500','not between 1 and 6000');
 definition:=replace(definition,'Contents must contain 1-3500 characters','Contents must contain 1-6000 characters');execute definition;
end $$;
