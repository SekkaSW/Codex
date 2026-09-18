-- Atomic administration writes. Existing Atlas/bridge contracts are untouched.
alter table members add column if not exists version integer not null default 0;
alter table server_config add column if not exists additional_resources jsonb not null default '[]';
create table codex_owned_roles(guild_id text references server_config on delete cascade,role_id text not null,primary key(guild_id,role_id));
alter table codex_owned_roles enable row level security;
insert into codex_owned_roles select guild_id,discord_role_id from ranks where discord_role_id is not null union select guild_id,discord_role_id from duty_roles union select g.guild_id,e.discord_role_id from assignment_entries e join assignment_groups g on g.id=e.group_id where e.discord_role_id is not null on conflict do nothing;

create function codex_organization(p_guild text) returns jsonb language sql stable as $$
select jsonb_build_object(
 'ownedRoleIds',coalesce((select jsonb_agg(role_id) from codex_owned_roles where guild_id=p_guild),'[]'),
 'permissions',coalesce((select jsonb_agg(jsonb_build_object('guildId',guild_id,'roleId',discord_role_id,'tier',tier)) from permission_roles where guild_id=p_guild),'[]'),
 'ranks',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',id,'guildId',guild_id,'name',name,'roleId',discord_role_id,'tier',tier))) from ranks where guild_id=p_guild),'[]'),
 'branches',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name)) from rank_branches where guild_id=p_guild),'[]'),
 'edges',coalesce((select jsonb_agg(jsonb_build_object('guildId',guild_id,'branchId',branch_id,'fromRankId',from_rank_id,'toRankId',to_rank_id)) from rank_progression where guild_id=p_guild),'[]'),
 'duties',coalesce((select jsonb_agg(jsonb_build_object('guildId',guild_id,'roleId',discord_role_id,'displayName',display_name)) from duty_roles where guild_id=p_guild),'[]'),
 'groups',coalesce((select jsonb_agg(jsonb_build_object('id',id,'guildId',guild_id,'name',name,'multiple',allow_multiple,'required',required)) from assignment_groups where guild_id=p_guild),'[]'),
 'entries',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',e.id,'groupId',e.group_id,'name',e.name,'roleId',e.discord_role_id))) from assignment_entries e join assignment_groups g on g.id=e.group_id where g.guild_id=p_guild),'[]'),
 'resources',coalesce((select jsonb_agg(jsonb_build_object('guildId',guild_id,'key',resource_key,'discordId',discord_id,'kind',resource_kind)) from managed_resources where guild_id=p_guild),'[]'),
 'additionalResources',coalesce((select additional_resources from server_config where guild_id=p_guild),'[]'));
$$;

create function codex_save_organization(p_config jsonb,p_organization jsonb,p_actor text) returns void language plpgsql as $$
declare g text:=p_config->>'guildId'; r jsonb; previous jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(g,0));
 previous:=codex_organization(g);
 if exists(select 1 from ranks where guild_id<>g and id in(select (x->>'id')::uuid from jsonb_array_elements(p_organization->'ranks') x)) or exists(select 1 from rank_branches where guild_id<>g and id in(select (x->>'id')::uuid from jsonb_array_elements(p_organization->'branches') x)) or exists(select 1 from assignment_groups where guild_id<>g and id in(select (x->>'id')::uuid from jsonb_array_elements(p_organization->'groups') x)) or exists(select 1 from assignment_entries e join assignment_groups a on a.id=e.group_id where a.guild_id<>g and e.id in(select (x->>'id')::uuid from jsonb_array_elements(p_organization->'entries') x)) then raise exception 'Configuration identity belongs to another guild'; end if;
 insert into server_config(guild_id,organization_name,command_namespace,confidentiality_marker,additional_resources)
 values(g,p_config->>'organizationName',p_config->>'commandNamespace',p_config->>'confidentialityMarker',p_organization->'additionalResources')
 on conflict(guild_id) do update set organization_name=excluded.organization_name,command_namespace=excluded.command_namespace,confidentiality_marker=excluded.confidentiality_marker,additional_resources=excluded.additional_resources,updated_at=now();
 for r in select jsonb_build_object('key',key,'value',value) from jsonb_each(p_config->'modules') loop
  insert into server_modules values(g,r->>'key',(r->>'value')::boolean) on conflict(guild_id,module_key) do update set enabled=excluded.enabled;
 end loop;
 -- Never silently remove live member state when an administrator deletes a definition.
 if exists(select 1 from members where guild_id=g and rank_id is not null and not exists(select 1 from jsonb_array_elements(p_organization->'ranks') x where (x->>'id')::uuid=rank_id)) then raise exception 'A removed rank is still assigned to members'; end if;
 if exists(select 1 from member_duties where guild_id=g and not exists(select 1 from jsonb_array_elements(p_organization->'duties') x where x->>'roleId'=discord_role_id)) then raise exception 'Remove member duties before deleting their definition'; end if;
 if exists(select 1 from member_assignments where guild_id=g and not exists(select 1 from jsonb_array_elements(p_organization->'entries') x where (x->>'id')::uuid=entry_id)) then raise exception 'Remove member assignments before deleting their definition'; end if;
 delete from permission_roles where guild_id=g;
 for r in select * from jsonb_array_elements(p_organization->'permissions') loop insert into permission_roles values(g,r->>'roleId',(r->>'tier')::permission_tier); end loop;
 delete from rank_progression where guild_id=g;
 delete from ranks where guild_id=g and id not in(select (x->>'id')::uuid from jsonb_array_elements(p_organization->'ranks') x);
 delete from rank_branches where guild_id=g and id not in(select (x->>'id')::uuid from jsonb_array_elements(p_organization->'branches') x);
 for r in select * from jsonb_array_elements(p_organization->'branches') loop
  insert into rank_branches(id,guild_id,name) values((r->>'id')::uuid,g,r->>'name') on conflict(id) do update set name=excluded.name where rank_branches.guild_id=g;
 end loop;
 for r in select * from jsonb_array_elements(p_organization->'ranks') loop
  insert into ranks(id,guild_id,name,discord_role_id,tier) values((r->>'id')::uuid,g,r->>'name',r->>'roleId',(r->>'tier')::permission_tier) on conflict(id) do update set name=excluded.name,discord_role_id=excluded.discord_role_id,tier=excluded.tier where ranks.guild_id=g;
 end loop;
 for r in select * from jsonb_array_elements(p_organization->'edges') loop
  if r->>'fromRankId'=r->>'toRankId' or not exists(select 1 from ranks where id=(r->>'fromRankId')::uuid and guild_id=g) or not exists(select 1 from ranks where id=(r->>'toRankId')::uuid and guild_id=g) or not exists(select 1 from rank_branches where id=(r->>'branchId')::uuid and guild_id=g) then raise exception 'Invalid guild-scoped progression edge'; end if;
  insert into rank_progression values(g,(r->>'branchId')::uuid,(r->>'fromRankId')::uuid,(r->>'toRankId')::uuid);
 end loop;
 delete from duty_roles where guild_id=g and discord_role_id not in(select x->>'roleId' from jsonb_array_elements(p_organization->'duties') x);
 for r in select * from jsonb_array_elements(p_organization->'duties') loop insert into duty_roles values(g,r->>'roleId',r->>'displayName') on conflict(guild_id,discord_role_id) do update set display_name=excluded.display_name; end loop;
 delete from assignment_entries where group_id in(select id from assignment_groups where guild_id=g) and id not in(select (x->>'id')::uuid from jsonb_array_elements(p_organization->'entries') x);
 delete from assignment_groups where guild_id=g and id not in(select (x->>'id')::uuid from jsonb_array_elements(p_organization->'groups') x);
 for r in select * from jsonb_array_elements(p_organization->'groups') loop
  insert into assignment_groups values((r->>'id')::uuid,g,r->>'name',(r->>'multiple')::boolean,(r->>'required')::boolean) on conflict(id) do update set name=excluded.name,allow_multiple=excluded.allow_multiple,required=excluded.required where assignment_groups.guild_id=g;
 end loop;
 for r in select * from jsonb_array_elements(p_organization->'entries') loop
  if not exists(select 1 from assignment_groups where id=(r->>'groupId')::uuid and guild_id=g) then raise exception 'Unknown assignment group'; end if;
  insert into assignment_entries values((r->>'id')::uuid,(r->>'groupId')::uuid,r->>'name',r->>'roleId') on conflict(id) do update set group_id=excluded.group_id,name=excluded.name,discord_role_id=excluded.discord_role_id;
 end loop;
 if exists(select 1 from members m cross join assignment_groups a where m.guild_id=g and a.guild_id=g and ((a.required and m.status='ACTIVE' and not exists(select 1 from member_assignments ma join assignment_entries e on e.id=ma.entry_id where ma.guild_id=g and ma.discord_member_id=m.discord_member_id and e.group_id=a.id)) or (not a.allow_multiple and (select count(*) from member_assignments ma join assignment_entries e on e.id=ma.entry_id where ma.guild_id=g and ma.discord_member_id=m.discord_member_id and e.group_id=a.id)>1))) then raise exception 'Configuration would invalidate existing member assignments; update membership or status first'; end if;
 delete from managed_resources where guild_id=g and resource_key in ('BOT_COMMANDS','BOT_LOGS') and resource_key not in(select x->>'key' from jsonb_array_elements(p_organization->'resources') x);
 insert into codex_owned_roles select g,discord_role_id from ranks where guild_id=g and discord_role_id is not null union select g,discord_role_id from duty_roles where guild_id=g union select g,e.discord_role_id from assignment_entries e join assignment_groups a on a.id=e.group_id where a.guild_id=g and e.discord_role_id is not null on conflict do nothing;
 for r in select * from jsonb_array_elements(p_organization->'resources') loop
  insert into managed_resources(guild_id,resource_key,discord_id,resource_kind) values(g,r->>'key',r->>'discordId',r->>'kind') on conflict(guild_id,resource_key) do update set discord_id=excluded.discord_id,resource_kind=excluded.resource_kind;
 end loop;
 insert into audit_events(guild_id,actor_id,subject_id,event_type,detail) values(g,p_actor,g,'CONFIGURATION_CHANGED',jsonb_build_object('before',previous,'after',p_organization,'config',p_config));
end;
$$;

create function codex_save_draft(p_draft jsonb) returns void language plpgsql as $$
declare existing setup_drafts%rowtype; g text:=p_draft->>'guildId';
begin
 perform pg_advisory_xact_lock(hashtextextended(g,0));
 select * into existing from setup_drafts where guild_id=g for update;
 if found and (existing.owner_id<>p_draft->>'ownerId' or existing.revision+1<>(p_draft->>'revision')::integer) then raise exception 'Setup draft changed concurrently; resume setup'; end if;
 insert into setup_drafts(guild_id,owner_id,stage,revision,payload,updated_at,expires_at) values(g,p_draft->>'ownerId',p_draft->>'stage',(p_draft->>'revision')::integer,p_draft,(p_draft->>'updatedAt')::timestamptz,(p_draft->>'expiresAt')::timestamptz)
 on conflict(guild_id) do update set stage=excluded.stage,revision=excluded.revision,payload=excluded.payload,updated_at=excluded.updated_at,expires_at=excluded.expires_at;
end;
$$;

create function codex_members(p_guild text,p_member text default null) returns jsonb language sql stable as $$
 select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('guildId',m.guild_id,'memberId',m.discord_member_id,'displayName',m.display_name,'rankId',m.rank_id,'status',m.status,'joinedAt',m.joined_at,'lastActiveAt',m.last_active_at,'notes',m.notes,'version',m.version,
 'dutyIds',coalesce((select jsonb_agg(discord_role_id) from member_duties where guild_id=m.guild_id and discord_member_id=m.discord_member_id),'[]'),
 'entryIds',coalesce((select jsonb_agg(entry_id) from member_assignments where guild_id=m.guild_id and discord_member_id=m.discord_member_id),'[]'))) order by m.display_name,m.discord_member_id),'[]')
 from members m where m.guild_id=p_guild and (p_member is null or m.discord_member_id=p_member);
$$;

create table codex_member_operations(id uuid primary key,guild_id text not null references server_config,created_at timestamptz not null default now());
alter table codex_member_operations enable row level security;
create function codex_operation_committed(p_operation uuid) returns boolean language sql stable as $$ select exists(select 1 from codex_member_operations where id=p_operation); $$;
create function codex_commit_member(p_before_version integer,p_member jsonb,p_actor text,p_action text,p_reason text,p_operation uuid default null) returns void language plpgsql as $$
declare g text:=p_member->>'guildId'; m text:=p_member->>'memberId'; old members%rowtype; item jsonb; grp record; n integer;
begin
 perform pg_advisory_xact_lock(hashtextextended(g,0));
 if p_operation is not null and exists(select 1 from codex_member_operations where id=p_operation) then return; end if;
 select * into old from members where guild_id=g and discord_member_id=m for update;
 if (found and old.version<>p_before_version) or (not found and p_before_version<>-1) then raise exception 'Member changed concurrently; reload and retry'; end if;
 if p_member->>'rankId' is not null and not exists(select 1 from ranks where guild_id=g and id=(p_member->>'rankId')::uuid) then raise exception 'Unknown guild rank'; end if;
 if p_action='MEMBER_PROMOTED' and not exists(select 1 from rank_progression where guild_id=g and from_rank_id=old.rank_id and to_rank_id=(p_member->>'rankId')::uuid) then raise exception 'No allowed advancement edge'; end if;
 for grp in select * from assignment_groups where guild_id=g loop
  select count(*) into n from assignment_entries where group_id=grp.id and id in(select value::uuid from jsonb_array_elements_text(p_member->'entryIds'));
  if (not grp.allow_multiple and n>1) or (grp.required and n=0 and p_member->>'status'='ACTIVE') then raise exception 'Assignment cardinality violation for %',grp.name; end if;
 end loop;
 insert into members(guild_id,discord_member_id,display_name,rank_id,status,joined_at,last_active_at,version,retired_at,left_at)
 values(g,m,p_member->>'displayName',(p_member->>'rankId')::uuid,(p_member->>'status')::member_status,(p_member->>'joinedAt')::timestamptz,(p_member->>'lastActiveAt')::timestamptz,0,case when p_member->>'status'='RETIRED' then now() end,case when p_member->>'status'='LEFT' then now() end)
 on conflict(guild_id,discord_member_id) do update set display_name=excluded.display_name,rank_id=excluded.rank_id,status=excluded.status,joined_at=coalesce(excluded.joined_at,members.joined_at),last_active_at=excluded.last_active_at,version=members.version+1,updated_at=now(),retired_at=case when excluded.status='RETIRED' then coalesce(members.retired_at,now()) else null end,left_at=case when excluded.status='LEFT' then coalesce(members.left_at,now()) else null end;
 delete from member_duties where guild_id=g and discord_member_id=m;
 for item in select * from jsonb_array_elements(p_member->'dutyIds') loop insert into member_duties(guild_id,discord_member_id,discord_role_id) values(g,m,item#>>'{}'); end loop;
 delete from member_assignments where guild_id=g and discord_member_id=m;
 for item in select * from jsonb_array_elements(p_member->'entryIds') loop
  if not exists(select 1 from assignment_entries e join assignment_groups a on a.id=e.group_id where e.id=(item#>>'{}')::uuid and a.guild_id=g) then raise exception 'Unknown guild assignment'; end if;
  insert into member_assignments(guild_id,discord_member_id,entry_id) values(g,m,(item#>>'{}')::uuid);
 end loop;
 if old.rank_id is distinct from (p_member->>'rankId')::uuid then insert into member_rank_history(guild_id,discord_member_id,from_rank_id,to_rank_id,changed_by,reason) values(g,m,old.rank_id,(p_member->>'rankId')::uuid,p_actor,p_reason); end if;
 insert into audit_events(guild_id,actor_id,subject_id,event_type,detail) values(g,p_actor,m,p_action,jsonb_build_object('before',to_jsonb(old),'after',p_member,'reason',p_reason));
 if p_operation is not null then insert into codex_member_operations(id,guild_id) values(p_operation,g); end if;
end;
$$;

create function codex_add_note(p_guild text,p_member text,p_actor text,p_body text,p_visibility text) returns void language plpgsql as $$
begin
 insert into member_notes(guild_id,discord_member_id,author_id,body,visibility) values(p_guild,p_member,p_actor,p_body,p_visibility);
 insert into audit_events(guild_id,actor_id,subject_id,event_type,detail) values(p_guild,p_actor,p_member,'MEMBER_NOTE_ADDED',jsonb_build_object('visibility',p_visibility));
end;
$$;

-- All administration data and RPCs are server-only.
grant select,insert,update,delete on server_config,server_modules,permission_roles,ranks,rank_branches,rank_progression,duty_roles,assignment_groups,assignment_entries,member_assignments,member_duties,member_rank_history,audit_events,managed_resources,members,member_notes,setup_drafts,codex_owned_roles,codex_member_operations to service_role;
do $$ declare t text; f record; begin
 foreach t in array array['permission_roles','ranks','rank_branches','rank_progression','duty_roles','assignment_groups','assignment_entries','member_assignments','member_duties','member_rank_history','audit_events','managed_resources','server_modules'] loop execute format('alter table %I enable row level security',t); end loop;
 for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname in('codex_organization','codex_save_organization','codex_members','codex_commit_member','codex_add_note','codex_save_draft','codex_operation_committed') loop
  execute format('revoke all on function %s from public, anon, authenticated',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
