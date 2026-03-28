import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getDashboardDataForUser } from "../../lib/dashboard-fetch";

export default async function CampaignsPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/");
  }

  const data = await getDashboardDataForUser(userId);
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-semibold text-[var(--text)]">Campaign Library</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">All campaigns connected to your workspace identity.</p>

      <div className="mt-6 space-y-3">
        {data.campaigns.map((campaign) => {
          const keywordCount = data.keywords.filter((keyword) => keyword.campaign_id === campaign.id).length;
          const contentCount = data.content.filter((content) => content.campaign_id === campaign.id).length;
          const outreachCount = data.outreach.filter((outreach) => outreach.campaign_id === campaign.id).length;
          return (
            <article key={campaign.id} className="rounded-xl border border-white/10 bg-[var(--panel)] p-4">
              <p className="font-semibold text-[var(--text)]">{campaign.target_url ?? campaign.seed_topic}</p>
              <p className="text-xs text-[var(--muted)]">Status: {campaign.status}</p>
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-[var(--muted)]">
                <span>{keywordCount} keywords</span>
                <span>{contentCount} content records</span>
                <span>{outreachCount} outreach targets</span>
              </div>
            </article>
          );
        })}
      </div>

      {data.campaigns.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--muted)]">
          No campaigns yet. Launch one from <Link href="/dashboard" className="underline text-cyan-300">Dashboard</Link>.
        </p>
      ) : null}
    </main>
  );
}
