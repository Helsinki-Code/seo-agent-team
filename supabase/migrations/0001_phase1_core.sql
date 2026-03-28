create extension if not exists pgcrypto;
create extension if not exists vector;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  target_url text,
  seed_topic text,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  initiated_by text not null default 'web' check (initiated_by in ('telegram', 'web', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaigns_target_or_topic check (target_url is not null or seed_topic is not null)
);

create table if not exists public.keywords (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  keyword text not null,
  intent text,
  difficulty numeric(5,2),
  serp_snapshot jsonb not null default '{}'::jsonb,
  rank_position integer,
  source_agent text not null default 'Brahma',
  created_at timestamptz not null default now()
);

create table if not exists public.content_pipeline (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  title text not null,
  slug text not null,
  html_content text not null,
  featured_image_url text,
  cms_target text,
  publish_status text not null default 'draft' check (publish_status in ('draft', 'scheduled', 'published', 'failed')),
  published_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.backlink_outreach (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  prospect_domain text not null,
  contact_name text,
  contact_email text,
  pitch_subject text,
  pitch_body text,
  outreach_status text not null default 'queued' check (outreach_status in ('queued', 'sent', 'replied', 'won', 'lost')),
  sent_at timestamptz,
  response_status text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_logs (
  id bigint generated always as identity primary key,
  campaign_id uuid references public.campaigns(id) on delete set null,
  agent_name text not null,
  level text not null default 'info' check (level in ('info', 'warn', 'error')),
  state text not null,
  message text not null,
  payload jsonb not null default '{}'::jsonb,
  skill_name text,
  installed_skill_version text,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

create index if not exists idx_campaigns_status on public.campaigns(status);
create index if not exists idx_keywords_campaign_id on public.keywords(campaign_id);
create index if not exists idx_content_pipeline_campaign_id on public.content_pipeline(campaign_id);
create index if not exists idx_backlink_outreach_campaign_id on public.backlink_outreach(campaign_id);
create index if not exists idx_agent_logs_campaign_id on public.agent_logs(campaign_id);
create index if not exists idx_agent_logs_created_at on public.agent_logs(created_at desc);
create index if not exists idx_agent_logs_state on public.agent_logs(state);

drop trigger if exists trg_campaigns_updated_at on public.campaigns;
create trigger trg_campaigns_updated_at
before update on public.campaigns
for each row execute function public.set_updated_at();

drop trigger if exists trg_content_pipeline_updated_at on public.content_pipeline;
create trigger trg_content_pipeline_updated_at
before update on public.content_pipeline
for each row execute function public.set_updated_at();

drop trigger if exists trg_backlink_outreach_updated_at on public.backlink_outreach;
create trigger trg_backlink_outreach_updated_at
before update on public.backlink_outreach
for each row execute function public.set_updated_at();

do $$
begin
  alter publication supabase_realtime add table public.campaigns;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.keywords;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.content_pipeline;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.backlink_outreach;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.agent_logs;
exception
  when duplicate_object then null;
end;
$$;
