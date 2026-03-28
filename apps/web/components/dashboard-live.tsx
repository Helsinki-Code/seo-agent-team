"use client";

import { useRealtimeSeoData } from "../hooks/use-realtime-seo-data";
import type { DashboardPayload } from "../lib/seo-data";
import { StartCampaignForm } from "./start-campaign-form";

export function DashboardLive({ initialData }: { initialData: DashboardPayload }) {
  const { data, isRefreshing, statusMap, skillsMap, error, refreshNow } = useRealtimeSeoData(initialData);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8">
      {data.credentialRequests.filter((request) => request.status === "pending").length > 0 ? (
        <section className="rounded-xl border border-amber-300/40 bg-amber-400/10 px-4 py-3 text-sm">
          <p className="font-semibold text-amber-200">
            {data.credentialRequests.filter((request) => request.status === "pending").length} credential request(s) need attention
          </p>
          <p className="text-amber-100/90">
            Agents are waiting for provider keys. Open Settings and connect requested providers to resume execution.
          </p>
        </section>
      ) : null}

      <section className="grid gap-4 rounded-2xl border border-white/10 bg-[var(--panel)] p-5 md:grid-cols-4">
        <StatCard label="Campaigns" value={String(data.campaigns.length)} />
        <StatCard label="Tracked Keywords" value={String(data.keywords.length)} />
        <StatCard label="Published Assets" value={String(data.content.filter((item) => item.publish_status === "published").length)} />
        <StatCard label="Outreach Threads" value={String(data.outreach.length)} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <StartCampaignForm />

          <Panel
            title="Campaigns"
            subtitle="Live status of campaigns tied to your workspace"
            action={
              <button className="text-xs text-[var(--muted)] hover:text-[var(--text)]" onClick={() => void refreshNow()}>
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            }
          >
            <div className="space-y-2">
              {data.campaigns.map((campaign) => (
                <article key={campaign.id} className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm">
                  <p className="font-semibold text-[var(--text)]">{campaign.target_url ?? campaign.seed_topic}</p>
                  <p className="text-xs text-[var(--muted)]">Status: {campaign.status}</p>
                  <p className="text-xs text-[var(--muted)]">{new Date(campaign.created_at).toLocaleString()}</p>
                </article>
              ))}
              {data.campaigns.length === 0 ? <p className="text-sm text-[var(--muted)]">No campaigns yet.</p> : null}
            </div>
          </Panel>

          <Panel title="Keyword Rankings" subtitle="Latest tracked positions from Nandi/Brahma">
            <div className="space-y-2">
              {data.keywords.slice(0, 20).map((row) => (
                <article key={row.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium text-[var(--text)]">{row.keyword}</p>
                    <p className="text-xs text-[var(--muted)]">{row.intent ?? "Intent pending"}</p>
                  </div>
                  <p className="text-sm font-semibold text-[var(--text)]">{row.rank_position ? `#${row.rank_position}` : "—"}</p>
                </article>
              ))}
              {data.keywords.length === 0 ? <p className="text-sm text-[var(--muted)]">No keyword records yet.</p> : null}
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Agent States" subtitle="Realtime execution feed from Supabase">
            <div className="space-y-2">
              {Object.values(statusMap).map((status) => (
                <article key={status.agentName} className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm">
                  <p className="font-semibold text-[var(--text)]">{status.agentName}</p>
                  <p className="text-xs text-cyan-300">{status.state}</p>
                  <p className="text-xs text-[var(--muted)]">{status.message}</p>
                  <p className="text-xs text-[var(--muted)]">{new Date(status.updatedAt).toLocaleString()}</p>
                </article>
              ))}
            </div>
          </Panel>

          <Panel title="Equipped Skills" subtitle="Most recent discovered/installed skills per agent">
            <div className="space-y-2">
              {Object.entries(skillsMap).map(([agent, skills]) => (
                <article key={agent} className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm">
                  <p className="font-semibold text-[var(--text)]">{agent}</p>
                  <p className="text-xs text-[var(--muted)]">{skills.join(", ")}</p>
                </article>
              ))}
              {Object.keys(skillsMap).length === 0 ? <p className="text-sm text-[var(--muted)]">No installed skills yet.</p> : null}
            </div>
          </Panel>

          <Panel title="Published Content" subtitle="Latest content pipeline items">
            <div className="space-y-2">
              {data.content.slice(0, 15).map((item) => (
                <article key={item.id} className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm">
                  <p className="font-semibold text-[var(--text)]">{item.title}</p>
                  <p className="text-xs text-[var(--muted)]">Status: {item.publish_status}</p>
                  {item.published_url ? (
                    <a href={item.published_url} className="text-xs text-cyan-300 underline" target="_blank" rel="noreferrer">
                      Open published URL
                    </a>
                  ) : null}
                </article>
              ))}
              {data.content.length === 0 ? <p className="text-sm text-[var(--muted)]">No content records yet.</p> : null}
            </div>
          </Panel>
        </div>
      </section>

      {error ? (
        <p className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p>
      ) : null}
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-lg border border-white/10 bg-black/20 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[var(--text)]">{value}</p>
    </article>
  );
}

function Panel({
  title,
  subtitle,
  children,
  action
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[var(--panel)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text)]">{title}</h2>
          <p className="text-xs text-[var(--muted)]">{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
