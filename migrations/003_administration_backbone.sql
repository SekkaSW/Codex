-- Durable, restart-safe administration workflow state. This migration is additive.
create table setup_drafts (
  guild_id text primary key,
  owner_id text not null,
  stage text not null check (stage in ('identity','namespace','permissions','ranks','duties','assignments','modules','resources','destinations','integration','preview','confirmation','provisioning')),
  revision integer not null default 0 check (revision >= 0),
  payload jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index setup_drafts_expiry_idx on setup_drafts(expires_at);
alter table setup_drafts enable row level security;

-- Notes need individual authorship and visibility rather than an unauditable array.
create table member_notes (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  discord_member_id text not null,
  author_id text not null,
  body text not null check (length(trim(body)) between 1 and 2000),
  visibility text not null default 'ADMIN' check (visibility in ('ADMIN','MEMBER')),
  created_at timestamptz not null default now(),
  foreign key(guild_id,discord_member_id) references members on delete cascade
);
create index member_notes_subject_idx on member_notes(guild_id,discord_member_id,created_at desc);
alter table member_notes enable row level security;

alter table members add column if not exists updated_at timestamptz not null default now();
alter table members add column if not exists retired_at timestamptz;
alter table members add column if not exists left_at timestamptz;
create index members_status_idx on members(guild_id,status);

-- Service-role access is used by the bot. No public RLS policies are installed.
