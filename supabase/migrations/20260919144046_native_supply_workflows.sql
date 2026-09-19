-- Native multi-item Supply is separate from historical scalar-stock campaigns.
-- Old campaigns/events and their compatibility controls remain intact.
create table supply_orders (
 guild_id text not null references server_config on delete cascade, id uuid not null,
 code text not null, name text not null check(length(trim(name)) between 1 and 100), client text not null,
 sale_price numeric not null check(sale_price between 0 and 1000000000), member_rate numeric not null check(member_rate between 0 and sale_price),
 organizer text not null, notes text, channel_id text not null, status text not null default 'Active' check(status in ('Active','Completed','Cancelled')),
 created_by text not null, created_at timestamptz not null default now(),primary key(guild_id,id),unique(guild_id,code)
);
create table supply_order_items (
 guild_id text not null, order_id uuid not null, id uuid not null default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 100),
 quota bigint not null check(quota between 1 and 1000000000), position integer not null,
 primary key(guild_id,id),unique(guild_id,order_id,id),foreign key(guild_id,order_id) references supply_orders on delete cascade
);
create unique index supply_order_item_name on supply_order_items(guild_id,order_id,lower(name));
create table supply_contributions (
 guild_id text not null,order_id uuid not null,id uuid not null default gen_random_uuid(),item_id uuid not null,
 actor_id text not null,member_id text not null,quantity bigint not null check(quantity between 1 and 1000000000),note text check(length(note)<=500),
 operation uuid not null,created_at timestamptz not null default now(),voided boolean not null default false,
 allocations jsonb, redistribution uuid, primary key(guild_id,id),
 foreign key(guild_id,order_id,item_id) references supply_order_items(guild_id,order_id,id) on delete cascade
);
create table supply_operation_receipts(guild_id text not null references server_config on delete cascade,id uuid not null,request jsonb not null,result jsonb not null,primary key(guild_id,id));
create index supply_contributions_order on supply_contributions(guild_id,order_id,created_at);
create function codex_supply_snapshot(p_guild text,p_id uuid) returns jsonb language sql set search_path=public as $$
 select to_jsonb(o)||jsonb_build_object(
 'items',coalesce((select jsonb_agg(to_jsonb(x) order by position) from(select i.*,coalesce((select sum(quantity) from supply_contributions c where c.guild_id=p_guild and c.order_id=p_id and c.item_id=i.id and not voided),0) contributed from supply_order_items i where i.guild_id=p_guild and i.order_id=p_id)x),'[]'),
 'credits',coalesce((select jsonb_agg(to_jsonb(x)) from(select member_id,sum(quantity) quantity,sum(quantity)*o.member_rate payout from (
 select c.member_id,c.quantity::numeric from supply_contributions c where c.guild_id=p_guild and c.order_id=p_id and not voided and allocations is null
 union all select a->>'member_id',(a->>'quantity')::numeric from supply_contributions c cross join lateral jsonb_array_elements(c.allocations) a where c.guild_id=p_guild and c.order_id=p_id and not voided and allocations is not null
 )z group by member_id order by member_id)x),'[]')) from supply_orders o where o.guild_id=p_guild and o.id=p_id
$$;
create function codex_supply(p_guild text,p_action text,p_actor text,p_key text default null,p_operation uuid default null,p_data jsonb default '{}') returns jsonb language plpgsql set search_path=public as $$
declare o supply_orders;item supply_order_items;e supply_contributions;r supply_operation_receipts;v jsonb;result jsonb;request jsonb;seen uuid[]:='{}';q numeric;total numeric;weights numeric;allocated bigint;recipient record;v_allocations jsonb;cutoff timestamptz;source text;counted integer:=0;begin
 perform pg_advisory_xact_lock(hashtextextended(p_guild,0));
 if not exists(select 1 from server_modules where guild_id=p_guild and module_key='supply' and enabled) then raise exception 'Supply is disabled';end if;
 if p_action='list' then return coalesce((select jsonb_agg(to_jsonb(x)) from(select id,code,name,status from supply_orders where guild_id=p_guild and (code ilike '%'||coalesce(p_key,'')||'%' or name ilike '%'||coalesce(p_key,'')||'%') order by created_at desc,id limit 25)x),'[]');end if;
 request:=jsonb_build_object('action',p_action,'actor',p_actor,'key',p_key,'data',p_data);
 if p_action not in ('get','status','contributors','refresh') then
  if p_operation is null then raise exception 'Supply operation receipt required';end if;
  select * into r from supply_operation_receipts where guild_id=p_guild and id=p_operation;
  if found then if r.request<>request then raise exception 'Supply operation was already used with different inputs';end if;return r.result;end if;
 end if;
 if p_action='create' then
  if jsonb_array_length(p_data->'items') not between 1 and 4 or coalesce(length(trim(p_data->>'client')),0) not between 1 and 100 or coalesce(length(p_data->>'notes'),0)>1000 then raise exception 'Supply requires a client and one to four item quotas';end if;
  insert into supply_orders(guild_id,id,code,name,client,sale_price,member_rate,organizer,notes,channel_id,created_by)
  values(p_guild,p_operation,'SUP-'||upper(replace(p_operation::text,'-','')),trim(p_data->>'name'),trim(p_data->>'client'),(p_data->>'sale_price')::numeric,(p_data->>'member_rate')::numeric,coalesce(p_data->>'organizer',p_actor),p_data->>'notes',p_data->>'channel',p_actor) returning * into o;
  counted:=0;for v in select value from jsonb_array_elements(p_data->'items') loop
   q:=(v->>'quantity')::numeric;if q<>trunc(q) then raise exception 'Supply quota must be an integer';end if;
   insert into supply_order_items(guild_id,order_id,name,quota,position) values(p_guild,o.id,trim(v->>'name'),q,counted);counted:=counted+1;
  end loop;
 else
  select * into o from supply_orders where guild_id=p_guild and (code=p_key or id::text=p_key) for update;
  if not found then raise exception 'Supply assignment not found in this server';end if;
  if p_action='log' then
   if o.status<>'Active' then raise exception 'Supply assignment is not active';end if;
   if coalesce(jsonb_array_length(p_data->'items'),0) not between 1 and 4 or coalesce(length(p_data->>'member'),0)=0 then raise exception 'Supply requires one to four items and a credited member';end if;
   for v in select value from jsonb_array_elements(p_data->'items') loop
    select * into item from supply_order_items where guild_id=p_guild and order_id=o.id and (id::text=v->>'item' or lower(name)=lower(v->>'item'));
    if not found then raise exception 'Supply item not found in this assignment';end if;
    if item.id=any(seen) then raise exception 'Supply items must not repeat';end if;seen:=array_append(seen,item.id);
    q:=(v->>'quantity')::numeric;if q is null or q<1 or q>1000000000 or q<>trunc(q) then raise exception 'Supply quantity must be a positive integer';end if;
    select coalesce(sum(quantity),0) into total from supply_contributions where guild_id=p_guild and order_id=o.id and item_id=item.id and not voided;
    if total+q>item.quota then raise exception 'Supply quantity exceeds the remaining item quota';end if;
    insert into supply_contributions(guild_id,order_id,item_id,actor_id,member_id,quantity,note,operation) values(p_guild,o.id,item.id,p_actor,p_data->>'member',q,p_data->>'note',p_operation);
   end loop;
   if not exists(select 1 from supply_order_items i where i.guild_id=p_guild and i.order_id=o.id and i.quota>(select coalesce(sum(c.quantity),0) from supply_contributions c where c.guild_id=p_guild and c.item_id=i.id and not c.voided)) then update supply_orders set status='Completed' where guild_id=p_guild and id=o.id;end if;
  elsif p_action='undo-last' then
   select * into e from supply_contributions where guild_id=p_guild and order_id=o.id and member_id=p_data->>'member' and not voided order by created_at desc,id desc limit 1 for update;
   if not found then raise exception 'Supply has no contribution to undo';end if;
   if e.allocations is not null then raise exception 'Supply contribution has been redistributed and cannot be undone separately';end if;
   update supply_contributions set voided=true where guild_id=p_guild and id=e.id;
   if o.status='Completed' then update supply_orders set status='Active' where guild_id=p_guild and id=o.id;end if;
  elsif p_action='redistribute' then
   source:=p_data->>'source';cutoff:=(p_data->>'before')::timestamptz;
   if cutoff is null or p_data->>'method' not in('weighted','even') then raise exception 'Supply redistribution needs a cutoff and method';end if;
   -- Lock scope covers every source row and receipt; all allocations commit together.
   for e in select * from supply_contributions where guild_id=p_guild and order_id=o.id and member_id=source and created_at<cutoff and not voided and allocations is null order by created_at,id for update loop
    -- Prefer same-item contributors; fall back to contributors across the assignment.
    select coalesce(sum((a->>'quantity')::numeric),0) into weights from jsonb_array_elements(codex_supply_snapshot(p_guild,o.id)->'credits') a where a->>'member_id'<>source;
    if weights<=0 then raise exception 'Supply has no other contributors to receive credit';end if;
    v_allocations:='[]';allocated:=0;
    for recipient in with effective as(
     select member_id,item_id,quantity::numeric quantity from supply_contributions where guild_id=p_guild and order_id=o.id and not voided and allocations is null
     union all select a->>'member_id',c.item_id,(a->>'quantity')::numeric from supply_contributions c cross join lateral jsonb_array_elements(c.allocations) a where c.guild_id=p_guild and c.order_id=o.id and not c.voided
    ), chosen as(select member_id,sum(quantity) weight from effective where member_id<>source and (item_id=e.item_id or not exists(select 1 from effective where item_id=e.item_id and member_id<>source and quantity>0)) group by member_id having sum(quantity)>0), shares as(select member_id,e.quantity*(case when p_data->>'method'='even' then 1::numeric/count(*) over() else weight/sum(weight) over() end) exact from chosen), ranked as(select *,floor(exact)::bigint base,row_number() over(order by exact-floor(exact) desc,member_id) n,e.quantity-sum(floor(exact)) over() remainder from shares)
     select member_id,base+case when n<=remainder then 1 else 0 end quantity from ranked order by member_id loop
      if recipient.quantity>0 then v_allocations:=v_allocations||jsonb_build_array(jsonb_build_object('member_id',recipient.member_id,'quantity',recipient.quantity));allocated:=allocated+recipient.quantity;end if;
    end loop;
    if allocated<>e.quantity then raise exception 'Supply redistribution totals do not balance';end if;
    update supply_contributions set allocations=v_allocations,redistribution=p_operation where guild_id=p_guild and id=e.id;counted:=counted+1;
   end loop;
   if counted=0 then raise exception 'Supply has no unreassigned contributions before this cutoff';end if;
  elsif p_action in('close','reopen','cancel') then update supply_orders set status=case p_action when 'close' then 'Completed' when 'reopen' then 'Active' else 'Cancelled' end where guild_id=p_guild and id=o.id;
  elsif p_action not in('get','status','contributors','refresh') then raise exception 'Unknown Supply action';end if;
 end if;
 result:=codex_supply_snapshot(p_guild,o.id);
 if p_action not in('get','status','contributors','refresh') then
  insert into supply_operation_receipts values(p_guild,p_operation,request,result);
  insert into audit_events(guild_id,actor_id,subject_id,event_type,detail) values(p_guild,p_actor,o.id::text,'SUPPLY_'||upper(p_action),jsonb_build_object('operation',p_operation,'input',p_data));
 end if;
 return result;
end $$;
do $$ declare t text;begin foreach t in array array['supply_orders','supply_order_items','supply_contributions','supply_operation_receipts'] loop execute format('alter table %I enable row level security',t);execute format('revoke all on %I from public,anon,authenticated',t);execute format('grant select,insert,update,delete on %I to service_role',t);end loop;end $$;
revoke all on function codex_supply_snapshot(text,uuid),codex_supply(text,text,text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function codex_supply_snapshot(text,uuid),codex_supply(text,text,text,text,uuid,jsonb) to service_role;
