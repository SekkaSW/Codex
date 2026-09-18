-- Production feature storage layered on the generalized 001 schema.
create type member_status as enum ('ACTIVE','INACTIVE','RETIRED','LEFT');
create table members (guild_id text references server_config on delete cascade, discord_member_id text not null, display_name text not null, rank_id uuid references ranks on delete set null, status member_status not null default 'ACTIVE', joined_at timestamptz, last_active_at timestamptz, notes text[] not null default '{}', primary key(guild_id,discord_member_id));
create table member_rank_history (id uuid primary key default gen_random_uuid(), guild_id text not null, discord_member_id text not null, from_rank_id uuid references ranks on delete set null, to_rank_id uuid references ranks on delete set null, changed_by text not null, reason text, created_at timestamptz not null default now(), foreign key(guild_id,discord_member_id) references members on delete cascade);
create table member_duties (guild_id text not null, discord_member_id text not null, discord_role_id text not null, assigned_at timestamptz not null default now(), primary key(guild_id,discord_member_id,discord_role_id), foreign key(guild_id,discord_member_id) references members on delete cascade, foreign key(guild_id,discord_role_id) references duty_roles on delete cascade);
create table audit_events (id uuid primary key default gen_random_uuid(), guild_id text references server_config on delete cascade, actor_id text, subject_id text, event_type text not null, detail jsonb not null default '{}', created_at timestamptz not null default now());

create table trailmarks (id uuid primary key default gen_random_uuid(), guild_id text references server_config on delete cascade, slug text not null, name text not null, channel_id text not null, active boolean not null default true, is_headquarters boolean not null default false, pinned boolean not null default false, location text, atlas_id text, unique(guild_id,slug), unique(guild_id,channel_id));
create unique index one_hq_trailmark_per_guild on trailmarks(guild_id) where is_headquarters and active;
create table trailmark_sessions (id uuid primary key, guild_id text references server_config on delete cascade, trailmark_id uuid references trailmarks on delete cascade, discord_member_id text not null, expires_at timestamptz not null, active boolean not null default true, created_at timestamptz not null default now());
create unique index one_active_trailmark_session_per_member on trailmark_sessions(guild_id,discord_member_id) where active;
create index trailmark_sessions_expiry_idx on trailmark_sessions(guild_id,expires_at) where active;

create type report_delivery_status as enum ('CAPTURED','AT_HQ','PUBLISHED');
create table intel_reports (id uuid primary key, guild_id text references server_config on delete cascade, body text not null, source text not null check(source in ('codex','legacy-wayfinder')), topic text, reporter_id text, source_trailmark_id uuid references trailmarks on delete set null, source_channel_id text, source_message_id text, deliverer_id text, delivery_status report_delivery_status not null default 'CAPTURED', linked_contact_ids uuid[] not null default '{}', created_at timestamptz not null);
create index intel_reports_delivery_idx on intel_reports(guild_id,delivery_status,created_at);
create table contacts (id uuid primary key default gen_random_uuid(), guild_id text references server_config on delete cascade, name text not null, kind text not null check(kind in ('CONTACT','GROUP')), forum_thread_id text, active boolean not null default true, detail jsonb not null default '{}', unique(guild_id,name));
create table contact_members (group_id uuid references contacts on delete cascade, contact_id uuid references contacts on delete cascade, primary key(group_id,contact_id), check(group_id <> contact_id));
create table contact_report_forwards (report_id uuid references intel_reports on delete cascade, contact_id uuid references contacts on delete cascade, discord_message_id text not null, created_at timestamptz not null default now(), primary key(report_id,contact_id));

create type ledger_kind as enum ('DEPOSIT','SPEND','ADJUSTMENT');
create table fund_ledger (id uuid primary key, guild_id text references server_config on delete cascade, amount numeric(14,2) not null check(amount <> 0), kind ledger_kind not null, actor_id text not null, note text not null, reversed_entry_id uuid references fund_ledger, created_at timestamptz not null default now());
create index fund_ledger_guild_date_idx on fund_ledger(guild_id,created_at);
create table strongbox_submissions (id uuid primary key, guild_id text references server_config on delete cascade, discord_member_id text not null, contents text not null, source_message_id text not null, status text not null check(status in ('SUBMITTED','PROCESSED')), created_at timestamptz not null default now());

create table applications (id uuid primary key default gen_random_uuid(), guild_id text references server_config on delete cascade, applicant_id text not null, duty_role_id text, answers jsonb not null default '{}', status text not null check(status in ('OPEN','WITHDRAWN','APPROVED','DENIED')), created_at timestamptz not null default now());
create table mentorships (id uuid primary key default gen_random_uuid(), guild_id text references server_config on delete cascade, mentor_id text, mentee_id text not null, status text not null check(status in ('LOOKING','PROPOSED','ACTIVE','ENDED')), created_at timestamptz not null default now());
create table votes (id uuid primary key default gen_random_uuid(), guild_id text references server_config on delete cascade, title text not null, options text[] not null, status text not null check(status in ('OPEN','CLOSED')), opened_by text not null, created_at timestamptz not null default now(), closed_at timestamptz);
create table vote_ballots (vote_id uuid references votes on delete cascade, discord_member_id text not null, selection text not null, created_at timestamptz not null default now(), primary key(vote_id,discord_member_id));
create table managed_assignments (id uuid primary key default gen_random_uuid(), guild_id text references server_config on delete cascade, title text not null, assignment_entry_id uuid references assignment_entries on delete set null, status text not null check(status in ('OPEN','CLOSED','CANCELLED')), payload jsonb not null default '{}', created_at timestamptz not null default now());
create table bot_message_state (guild_id text references server_config on delete cascade, state_key text not null, channel_id text not null, message_id text not null, updated_at timestamptz not null default now(), primary key(guild_id,state_key));
create table reference_entries (id uuid primary key default gen_random_uuid(), guild_id text references server_config on delete cascade, key text not null, title text not null, body text not null, updated_at timestamptz not null default now(), unique(guild_id,key));

create table bridge_destinations (id uuid primary key default gen_random_uuid(), guild_id text references server_config on delete cascade, name text not null, protocol text not null check(protocol in ('codex-v1','legacy-wayfinder')), endpoint text not null, secret_ciphertext text, active boolean not null default true, unique(guild_id,name));
create table bridge_deliveries (bridge_id uuid references bridge_destinations on delete cascade, report_id uuid references intel_reports on delete cascade, status text not null, detail text, created_at timestamptz not null default now(), primary key(bridge_id,report_id));

-- Atlas queue/link records are service-role managed; existing public-facing RPC names remain the compatibility boundary.
create table atlas_discord_links (id uuid primary key default gen_random_uuid(), guild_id text references server_config on delete cascade, discord_user_id text not null, code_hash text not null, expires_at timestamptz not null, claimed_at timestamptz, unique(code_hash));
create table atlas_trailmark_access_requests (id uuid primary key default gen_random_uuid(), guild_id text references server_config on delete cascade, discord_user_id text not null, trailmark_id uuid references trailmarks on delete cascade, status text not null default 'PENDING', detail text, created_at timestamptz not null default now());
create table atlas_trailmark_drops (id uuid primary key default gen_random_uuid(), guild_id text references server_config on delete cascade, discord_user_id text not null, trailmark_id uuid references trailmarks on delete cascade, payload jsonb not null, status text not null default 'PENDING', detail text, created_at timestamptz not null default now());
create index atlas_access_pending_idx on atlas_trailmark_access_requests(guild_id,status,created_at);
create index atlas_drops_pending_idx on atlas_trailmark_drops(guild_id,status,created_at);

alter table server_config enable row level security;
alter table members enable row level security;
alter table intel_reports enable row level security;
alter table contacts enable row level security;
alter table fund_ledger enable row level security;
alter table strongbox_submissions enable row level security;
alter table atlas_discord_links enable row level security;
alter table atlas_trailmark_access_requests enable row level security;
alter table atlas_trailmark_drops enable row level security;
-- No public policies are intentionally installed. The bot uses the Supabase service role;
-- browser Atlas access must be granted only through separately reviewed SECURITY DEFINER RPCs.
