alter table public.campaigns add column if not exists user_id text;
create index if not exists idx_campaigns_user_id on public.campaigns(user_id);

create table if not exists public.user_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  provider text not null,
  label text not null default 'default',
  encrypted_secret text not null,
  status text not null default 'active' check (status in ('active', 'invalid', 'revoked')),
  metadata jsonb not null default '{}'::jsonb,
  last_validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, label)
);

create table if not exists public.credential_requests (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  provider text not null,
  requested_by_agent text not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'resolved', 'dismissed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_user_integrations_user_id on public.user_integrations(user_id);
create index if not exists idx_credential_requests_user_id on public.credential_requests(user_id);
create index if not exists idx_credential_requests_status on public.credential_requests(status);

drop trigger if exists trg_user_integrations_updated_at on public.user_integrations;
create trigger trg_user_integrations_updated_at
before update on public.user_integrations
for each row execute function public.set_updated_at();

alter table public.campaigns enable row level security;
alter table public.keywords enable row level security;
alter table public.content_pipeline enable row level security;
alter table public.backlink_outreach enable row level security;
alter table public.agent_logs enable row level security;
alter table public.user_integrations enable row level security;
alter table public.credential_requests enable row level security;

drop policy if exists campaigns_select_own on public.campaigns;
create policy campaigns_select_own
on public.campaigns
for select
using (user_id = auth.jwt() ->> 'sub');

drop policy if exists campaigns_insert_own on public.campaigns;
create policy campaigns_insert_own
on public.campaigns
for insert
with check (user_id = auth.jwt() ->> 'sub');

drop policy if exists campaigns_update_own on public.campaigns;
create policy campaigns_update_own
on public.campaigns
for update
using (user_id = auth.jwt() ->> 'sub')
with check (user_id = auth.jwt() ->> 'sub');

drop policy if exists keywords_select_own_campaign on public.keywords;
create policy keywords_select_own_campaign
on public.keywords
for select
using (
  exists (
    select 1
    from public.campaigns c
    where c.id = keywords.campaign_id
      and c.user_id = auth.jwt() ->> 'sub'
  )
);

drop policy if exists content_pipeline_select_own_campaign on public.content_pipeline;
create policy content_pipeline_select_own_campaign
on public.content_pipeline
for select
using (
  exists (
    select 1
    from public.campaigns c
    where c.id = content_pipeline.campaign_id
      and c.user_id = auth.jwt() ->> 'sub'
  )
);

drop policy if exists backlink_outreach_select_own_campaign on public.backlink_outreach;
create policy backlink_outreach_select_own_campaign
on public.backlink_outreach
for select
using (
  exists (
    select 1
    from public.campaigns c
    where c.id = backlink_outreach.campaign_id
      and c.user_id = auth.jwt() ->> 'sub'
  )
);

drop policy if exists agent_logs_select_own_campaign on public.agent_logs;
create policy agent_logs_select_own_campaign
on public.agent_logs
for select
using (
  exists (
    select 1
    from public.campaigns c
    where c.id = agent_logs.campaign_id
      and c.user_id = auth.jwt() ->> 'sub'
  )
);

drop policy if exists user_integrations_select_own on public.user_integrations;
create policy user_integrations_select_own
on public.user_integrations
for select
using (user_id = auth.jwt() ->> 'sub');

drop policy if exists user_integrations_insert_own on public.user_integrations;
create policy user_integrations_insert_own
on public.user_integrations
for insert
with check (user_id = auth.jwt() ->> 'sub');

drop policy if exists user_integrations_update_own on public.user_integrations;
create policy user_integrations_update_own
on public.user_integrations
for update
using (user_id = auth.jwt() ->> 'sub')
with check (user_id = auth.jwt() ->> 'sub');

drop policy if exists credential_requests_select_own on public.credential_requests;
create policy credential_requests_select_own
on public.credential_requests
for select
using (user_id = auth.jwt() ->> 'sub');

drop policy if exists credential_requests_update_own on public.credential_requests;
create policy credential_requests_update_own
on public.credential_requests
for update
using (user_id = auth.jwt() ->> 'sub')
with check (user_id = auth.jwt() ->> 'sub');

do $$
begin
  alter publication supabase_realtime add table public.user_integrations;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.credential_requests;
exception
  when duplicate_object then null;
end;
$$;
