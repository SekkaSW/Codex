alter table strongbox_submissions drop constraint strongbox_submissions_status_check;
alter table strongbox_submissions add constraint strongbox_submissions_status_check check(status in('SUBMITTED','PROCESSED','REJECTED'));
alter table strongbox_submissions add column reviewed_by text,add column reviewed_at timestamptz,add column review_note text;
alter table applications add column reviewed_by text,add column reviewed_at timestamptz,add column review_note text;
create unique index one_open_application on applications(guild_id,applicant_id,duty_role_id) where status='OPEN';
alter table mentorships add column updated_at timestamptz not null default now(),add column changed_by text;
create unique index one_pending_mentorship on mentorships(guild_id,mentee_id) where status in('LOOKING','PROPOSED','ACTIVE');
alter table votes add column voter_tier permission_tier not null default 'BASELINE',add column permission_snapshot jsonb not null default '[]';
create table workflow_settings(guild_id text not null references server_config on delete cascade,system text not null,value jsonb not null default '{}',primary key(guild_id,system));
create table recruitment_events(guild_id text not null references server_config on delete cascade,member_id text not null,action text not null,channel_id text,code text,actor_id text not null,created_at timestamptz not null default now(),primary key(guild_id,member_id,action));
create or replace function codex_workflow(p_guild text,p_system text,p_action text,p_actor text,p_id uuid default null,p_data jsonb default '{}') returns jsonb language plpgsql set search_path=public as $$
declare result jsonb;s strongbox_submissions;a applications;m mentorships;v votes;b managed_assignments;page integer:=greatest(0,coalesce((p_data->>'page')::integer,0));begin
 perform pg_advisory_xact_lock(hashtext(p_guild));if not exists(select 1 from server_config where guild_id=p_guild) then raise exception 'Server not configured';end if;
 if p_action='settings' then return coalesce((select value from workflow_settings where guild_id=p_guild and system=p_system),'{}');
 elsif p_action='setup' then insert into workflow_settings values(p_guild,p_system,p_data) on conflict(guild_id,system) do update set value=excluded.value;result:=p_data;
 elsif p_system='strongbox' then
  if p_action='list' then return coalesce((select jsonb_agg(to_jsonb(x)) from(select * from strongbox_submissions where guild_id=p_guild and (coalesce((p_data->>'staff')::boolean,false) or discord_member_id=p_actor) order by created_at desc,id limit 25 offset page*25)x),'[]');end if;
  if p_action='submit' then
   if length(trim(p_data->>'contents')) not between 1 and 3500 then raise exception 'Contents must contain 1-3500 characters';end if;
   insert into strongbox_submissions(id,guild_id,discord_member_id,contents,source_message_id,status) values(p_id,p_guild,p_actor,p_data->>'contents',p_data->>'source','SUBMITTED') on conflict(id) do nothing;
  end if;
  select * into s from strongbox_submissions where guild_id=p_guild and id=p_id for update;if not found then raise exception 'Submission not found';end if;
  if p_action in('process','reject') then
   if s.status<>'SUBMITTED' then return to_jsonb(s);end if;
   update strongbox_submissions set status=case when p_action='process' then 'PROCESSED' else 'REJECTED' end,reviewed_by=p_actor,reviewed_at=now(),review_note=left(p_data->>'note',1000) where id=s.id returning * into s;
  elsif p_action not in('submit','get') then raise exception 'Unknown Strongbox action';end if;result:=to_jsonb(s);
 elsif p_system='application' then
  if p_action='list' then return coalesce((select jsonb_agg(to_jsonb(x)) from(select * from applications where guild_id=p_guild and (coalesce((p_data->>'staff')::boolean,false) or applicant_id=p_actor) order by created_at desc,id limit 25 offset page*25)x),'[]');end if;
  if p_action='apply' then
   if not exists(select 1 from duty_roles where guild_id=p_guild and discord_role_id=p_data->>'duty') then raise exception 'Select a currently configured duty';end if;
   if length(coalesce((p_data->'answers')::text,'')) not between 2 and 4000 then raise exception 'Invalid answers';end if;
   if not exists(select 1 from workflow_settings where guild_id=p_guild and system='application' and value->>'enabled'='true') then raise exception 'Applications are not enabled; ask an administrator to run setup';end if;
   insert into applications(id,guild_id,applicant_id,duty_role_id,answers,status) values(p_id,p_guild,p_actor,p_data->>'duty',p_data->'answers','OPEN') on conflict(id) do nothing;
  end if;
  select * into a from applications where guild_id=p_guild and id=p_id for update;if not found then raise exception 'Application not found';end if;
  if p_action='withdraw' then if a.applicant_id<>p_actor or a.status<>'OPEN' then raise exception 'Only your open application can be withdrawn';end if;update applications set status='WITHDRAWN' where id=a.id returning * into a;
  elsif p_action in('approve','deny') then if a.status<>'OPEN' then return to_jsonb(a);end if;update applications set status=case when p_action='approve' then 'APPROVED' else 'DENIED' end,reviewed_by=p_actor,reviewed_at=now(),review_note=left(p_data->>'note',1000) where id=a.id returning * into a;
  elsif p_action not in('apply','get') then raise exception 'Unknown application action';end if;result:=to_jsonb(a);
 elsif p_system='mentorship' then
  if p_action='list' then return coalesce((select jsonb_agg(to_jsonb(x)) from(select * from mentorships where guild_id=p_guild and (coalesce((p_data->>'all')::boolean,false) or mentee_id=p_actor or mentor_id=p_actor) order by created_at desc,id limit 25 offset page*25)x),'[]');end if;
  if p_action='looking-for' then
   if not exists(select 1 from members where guild_id=p_guild and discord_member_id=p_actor and status='ACTIVE') then raise exception 'Synchronize your active member record first';end if;
   insert into mentorships(id,guild_id,mentee_id,status,changed_by) values(p_id,p_guild,p_actor,'LOOKING',p_actor) on conflict(id) do nothing;
  end if;
  select * into m from mentorships where guild_id=p_guild and id=p_id for update;if not found then raise exception 'Mentorship request not found';end if;
  if p_action in('propose','sponsor','assign') then
   if m.status not in('LOOKING','PROPOSED') then raise exception 'Request is no longer available';end if;
   if p_data->>'mentor'=m.mentee_id or not exists(select 1 from members where guild_id=p_guild and discord_member_id=p_data->>'mentor' and status='ACTIVE') or not exists(select 1 from members where guild_id=p_guild and discord_member_id=m.mentee_id and status='ACTIVE') then raise exception 'Select two distinct active members';end if;
   if exists(with recursive parents(id) as(select p_data->>'mentor' union select mm.mentor_id from mentorships mm join parents p on mm.mentee_id=p.id where mm.guild_id=p_guild and mm.status='ACTIVE') select 1 from parents where id=m.mentee_id) then raise exception 'Mentorship cycle is not allowed';end if;
   update mentorships set mentor_id=p_data->>'mentor',status=case when p_action='assign' then 'ACTIVE' else 'PROPOSED' end where id=m.id;
  elsif p_action='withdraw-looking' then if m.mentee_id<>p_actor or m.status not in('LOOKING','PROPOSED') then raise exception 'Only your pending request can be withdrawn';end if;update mentorships set status='ENDED' where id=m.id;
  elsif p_action='end' then update mentorships set status='ENDED' where id=m.id;
  elsif p_action not in('looking-for','get') then raise exception 'Unknown mentorship action';end if;
  update mentorships set changed_by=p_actor,updated_at=now() where id=m.id returning * into m;result:=to_jsonb(m);
 elsif p_system='vote' then
  if p_action='list' then return coalesce((select jsonb_agg(to_jsonb(x)) from(select * from votes where guild_id=p_guild order by created_at desc,id limit 25 offset page*25)x),'[]');end if;
  if p_action='open' then
   if length(trim(p_data->>'title')) not between 1 and 200 or jsonb_array_length(p_data->'options') not between 2 and 25 then raise exception 'Poll needs a title and 2-25 choices';end if;
   if exists(select 1 from jsonb_array_elements_text(p_data->'options') x where length(x) not between 1 and 100) or (select count(distinct x) from jsonb_array_elements_text(p_data->'options') x)<>jsonb_array_length(p_data->'options') then raise exception 'Poll choices must be distinct, nonempty, and at most 100 characters';end if;
   insert into votes(id,guild_id,title,options,status,opened_by,voter_tier,permission_snapshot) values(p_id,p_guild,p_data->>'title',array(select jsonb_array_elements_text(p_data->'options')),'OPEN',p_actor,(p_data->>'tier')::permission_tier,coalesce((select jsonb_agg(jsonb_build_object('guildId',guild_id,'roleId',discord_role_id,'tier',tier)) from permission_roles where guild_id=p_guild),'[]')) on conflict(id) do nothing;
  end if;
  select * into v from votes where guild_id=p_guild and id=p_id for update;if not found then raise exception 'Poll not found';end if;
  if p_action='cast' then if v.status<>'OPEN' or not(p_data->>'selection'=any(v.options)) then raise exception 'Select a valid choice in an open poll';end if;insert into vote_ballots values(v.id,p_actor,p_data->>'selection',now());
  elsif p_action='close' then update votes set status='CLOSED',closed_at=coalesce(closed_at,now()) where id=v.id returning * into v;
  elsif p_action not in('open','get','audit') then raise exception 'Unknown vote action';end if;
  result:=to_jsonb(v)||jsonb_build_object('counts',coalesce((select jsonb_object_agg(selection,n) from(select selection,count(*) n from vote_ballots where vote_id=v.id group by selection)x),'{}'));
  if p_action='audit' then result:=result||jsonb_build_object('ballots',coalesce((select jsonb_agg(to_jsonb(x)) from vote_ballots x where vote_id=v.id),'[]'));end if;
 elsif p_system='assignment' then
  if p_action='list' then return coalesce((select jsonb_agg(to_jsonb(x)) from(select * from managed_assignments where guild_id=p_guild order by created_at desc,id limit 25 offset page*25)x),'[]');end if;
  if p_action='open' then if length(trim(p_data->>'title')) not between 1 and 200 or length(coalesce(p_data->>'description',''))>3500 then raise exception 'Invalid assignment';end if;insert into managed_assignments(id,guild_id,title,status,payload) values(p_id,p_guild,p_data->>'title','OPEN',jsonb_build_object('description',p_data->>'description','claimed',jsonb_build_array())) on conflict(id) do nothing;end if;
  select * into b from managed_assignments where guild_id=p_guild and id=p_id for update;if not found then raise exception 'Board item not found';end if;
  if p_action in('claim','unclaim') then
   if b.status<>'OPEN' then raise exception 'Board item is closed';end if;
   if p_action='claim' then if not(b.payload->'claimed' ? p_actor) then update managed_assignments set payload=jsonb_set(payload,'{claimed}',(payload->'claimed')||to_jsonb(p_actor)) where id=b.id;end if;
   else update managed_assignments set payload=jsonb_set(payload,'{claimed}',(payload->'claimed')-p_actor) where id=b.id;end if;
  elsif p_action in('close','cancel') then update managed_assignments set status=case when p_action='close' then 'CLOSED' else 'CANCELLED' end where id=b.id;
  elsif p_action not in('open','get') then raise exception 'Unknown board action';end if;
  select to_jsonb(x) into result from managed_assignments x where id=b.id;
 elsif p_system='recruit' then
  if p_action='get' then return (select to_jsonb(x) from recruitment_events x where guild_id=p_guild and member_id=p_data->>'member' and action=p_data->>'action');end if;
  if p_action<>'record' then raise exception 'Unknown recruitment action';end if;
  insert into recruitment_events(guild_id,member_id,action,channel_id,code,actor_id) values(p_guild,p_data->>'member',p_data->>'action',p_data->>'channel',p_data->>'code',p_actor) on conflict do nothing;result:=p_data;
 elsif p_system='message' then
  if p_action='get' then return (select to_jsonb(x) from bot_message_state x where guild_id=p_guild and state_key=p_data->>'key');end if;
  if p_action<>'save' then raise exception 'Unknown message action';end if;
  insert into bot_message_state(guild_id,state_key,channel_id,message_id) values(p_guild,p_data->>'key',p_data->>'channel',p_data->>'message') on conflict(guild_id,state_key) do update set channel_id=excluded.channel_id,message_id=excluded.message_id,updated_at=now();result:=p_data;
 else raise exception 'Unknown workflow';end if;
 insert into audit_events(guild_id,actor_id,subject_id,event_type,detail) values(p_guild,p_actor,p_id::text,upper(p_system)||'_'||upper(p_action),jsonb_build_object('id',p_id));return result;
end $$;
do $$ declare t text;begin foreach t in array array['strongbox_submissions','applications','mentorships','votes','vote_ballots','managed_assignments','workflow_settings','recruitment_events','bot_message_state'] loop execute format('alter table %I enable row level security',t);execute format('grant select,insert,update,delete on %I to service_role',t);end loop;end $$;
revoke all on function codex_workflow(text,text,text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function codex_workflow(text,text,text,text,uuid,jsonb) to service_role;
