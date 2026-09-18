-- Correct upgrades without changing the already committed phase schemas.
alter table intel_reports add column needs_processing boolean not null default true,add column processing_attempted_at timestamptz;
create index intel_report_work on intel_reports(guild_id,processing_attempted_at,created_at) where needs_processing and delivery_status in('AT_HQ','PUBLISHED');
-- Keep the earlier report_topics read surface while using one canonical table.
insert into audit_events(guild_id,actor_id,event_type,detail)
 select guild_id,'migration','LEGACY_REPORT_TOPICS_MIGRATED',to_jsonb(t) from report_topics t;
insert into intel_topics(id,guild_id,name,keywords)
 select id,guild_id,name,keywords from report_topics on conflict(guild_id,name) do nothing;
update managed_resources mr set resource_key='REPORT_TOPIC:'||it.id
 from report_topics rt join intel_topics it on it.guild_id=rt.guild_id and it.name=rt.name
 where mr.guild_id=rt.guild_id and mr.resource_key=rt.channel_resource_key
 and not exists(select 1 from managed_resources x where x.guild_id=it.guild_id and x.resource_key='REPORT_TOPIC:'||it.id);
drop table report_topics;
create view report_topics with(security_invoker=true) as select id,guild_id,name,keywords,'REPORT_TOPIC:'||id as channel_resource_key from intel_topics;
revoke all on report_topics from public,anon,authenticated;
grant select on report_topics to service_role;

-- The reset detaches only the override, never deletes a Discord channel or binds
-- one Discord ID to two registry keys (which the registry deliberately forbids).
do $$ declare definition text;begin
 definition:=pg_get_functiondef('codex_intelligence(text,text,text,uuid,jsonb)'::regprocedure);
 if position('if p_action=''topics'' then' in definition)=0 then raise exception 'Unexpected intelligence RPC revision';end if;
 definition:=replace(definition,'if p_action=''topics'' then','if p_action=''catchall-reset'' then delete from managed_resources where guild_id=p_guild and resource_key=''REPORT_CATCHALL'';insert into audit_events(guild_id,actor_id,event_type) values(p_guild,p_actor,''INTEL_CATCHALL_RESET'');return ''{}'';elsif p_action=''topics'' then');
 definition:=replace(definition,'or delivery_status in(''AT_HQ'',''PUBLISHED'')) order by created_at,id limit 25','or (needs_processing and delivery_status in(''AT_HQ'',''PUBLISHED''))) order by case when p_action=''pending'' then processing_attempted_at end nulls first,created_at,id limit 25');
 definition:=replace(definition,'if p_action=''report-get'' then return to_jsonb(r);end if;','if p_action=''report-get'' then return to_jsonb(r);end if; if p_action=''report-begin'' then update intel_reports set processing_attempted_at=now() where id=r.id;return to_jsonb(r);end if; if p_action=''report-complete'' then update intel_reports set needs_processing=false where id=r.id and delivery_status=''PUBLISHED'';return to_jsonb(r);end if;');
 definition:=replace(definition,'update intel_reports set linked_contact_ids=','update intel_reports set needs_processing=true,linked_contact_ids=');
 execute definition;
 definition:=pg_get_functiondef('codex_workflow(text,text,text,text,uuid,jsonb)'::regprocedure);
 definition:=replace(definition,'if m.status not in(''LOOKING'',''PROPOSED'') then','if p_action in(''propose'',''sponsor'') and m.status=''PROPOSED'' and m.mentor_id is distinct from p_actor then raise exception ''Another mentor already proposed; staff must resolve the request'';end if; if m.status not in(''LOOKING'',''PROPOSED'') then');
 execute definition;
 definition:=pg_get_functiondef('codex_trailmarks(text,text,text,uuid,jsonb)'::regprocedure);
 definition:=replace(definition,'order by expires_at,id limit 100) x','order by expires_at,id limit 100 offset greatest(0,coalesce((p_data->>''page'')::integer,0))*100) x');
 execute definition;
end $$;

create or replace function codex_check_guild_reference() returns trigger language plpgsql set search_path=public as $$
declare target_guild text;value text;begin
 value:=to_jsonb(new)->>tg_argv[1];if value is null then return new;end if;
 execute format('select guild_id from %I where id=$1::uuid',tg_argv[0]) into target_guild using value;
 if target_guild is distinct from to_jsonb(new)->>'guild_id' then raise exception 'Reference belongs to a different guild or is missing';end if;return new;end $$;
create trigger session_local_trailmark before insert or update on trailmark_sessions for each row execute function codex_check_guild_reference('trailmarks','trailmark_id');
create trigger report_local_trailmark before insert or update on intel_reports for each row execute function codex_check_guild_reference('trailmarks','source_trailmark_id');
create trigger access_local_trailmark before insert or update on atlas_trailmark_access_requests for each row execute function codex_check_guild_reference('trailmarks','trailmark_id');
create trigger drop_local_trailmark before insert or update on atlas_trailmark_drops for each row execute function codex_check_guild_reference('trailmarks','trailmark_id');
create trigger visit_local_session before insert or update on atlas_visits for each row execute function codex_check_guild_reference('trailmark_sessions','session_id');
create trigger member_local_rank before insert or update on members for each row execute function codex_check_guild_reference('ranks','rank_id');
create or replace function codex_check_contact_reference() returns trigger language plpgsql set search_path=public as $$declare a text;b text;begin
 if tg_table_name='contact_members' then select guild_id into a from contacts where id=new.group_id and kind='GROUP';select guild_id into b from contacts where id=new.contact_id and kind='CONTACT';
 else select guild_id into a from intel_reports where id=new.report_id;select guild_id into b from contacts where id=new.contact_id;end if;
 if a is null or b is null or a<>b then raise exception 'Contact references must belong to the same guild';end if;return new;end $$;
create trigger contact_group_local before insert or update on contact_members for each row execute function codex_check_contact_reference();
create trigger contact_forward_local before insert or update on contact_report_forwards for each row execute function codex_check_contact_reference();
alter table atlas_profiles add foreign key(guild_id) references server_config on delete cascade;
revoke all on function codex_check_guild_reference(),codex_check_contact_reference() from public,anon,authenticated;
grant execute on function codex_check_guild_reference(),codex_check_contact_reference() to service_role;
create function codex_contact_group_dirty() returns trigger language plpgsql set search_path=public as $$begin update intel_reports set needs_processing=true where coalesce(new.group_id,old.group_id)=any(linked_group_ids);return coalesce(new,old);end $$;
create trigger contact_group_report_work after insert or delete on contact_members for each row execute function codex_contact_group_dirty();
revoke all on function codex_contact_group_dirty() from public,anon,authenticated;
grant execute on function codex_contact_group_dirty() to service_role;

create function codex_funds_total(p_guild text) returns numeric language sql stable set search_path=public as $$select coalesce(sum(amount),0) from fund_ledger where guild_id=p_guild$$;
create function codex_funds_recent(p_guild text,p_limit integer) returns jsonb language sql stable set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',id,'guildId',guild_id,'amount',amount,'kind',kind,'actorId',actor_id,'note',note,'createdAt',created_at,'reversedEntryId',reversed_entry_id))),'[]') from(select * from fund_ledger where guild_id=p_guild order by created_at desc,id desc limit greatest(1,least(p_limit,25))) x$$;
revoke all on function codex_funds_total(text),codex_funds_recent(text,integer) from public,anon,authenticated;
grant execute on function codex_funds_total(text),codex_funds_recent(text,integer) to service_role;

-- Explicitly scope grants to Codex-owned tables, not other applications.
do $$ declare t text;begin foreach t in array array['advancement_ballots','advancement_cases','advancement_settings','applications','assignment_entries','assignment_groups','atlas_discord_links','atlas_identities','atlas_live_positions','atlas_profiles','atlas_trailmark_access_requests','atlas_trailmark_drops','atlas_visits','audit_events','bot_message_state','bridge_deliveries','bridge_destinations','bridge_ingestions','bridge_settings','briefings','codex_member_operations','codex_owned_roles','contact_discord_members','contact_members','contact_report_forwards','contacts','discord_deliveries','duty_roles','fund_ledger','intel_reports','intel_topics','managed_assignments','managed_resources','member_assignments','member_duties','member_notes','member_rank_history','members','mentorships','patrol_suggestions','permission_roles','rank_branches','rank_progression','ranks','recruitment_events','reference_entries','server_config','server_modules','setup_drafts','strongbox_submissions','supply_campaigns','supply_events','trailmark_sessions','trailmarks','vote_ballots','votes','workflow_settings'] loop execute format('alter table %I enable row level security',t);execute format('revoke all on %I from public,anon,authenticated',t);execute format('grant select,insert,update,delete on %I to service_role',t);end loop;end $$;
