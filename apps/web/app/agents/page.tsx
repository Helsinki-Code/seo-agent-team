import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getDashboardDataForUser } from "../../lib/dashboard-fetch";
import { deriveAgentStatus, deriveEquippedSkills } from "../../lib/seo-data";

export default async function AgentsPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/");
  }

  const data = await getDashboardDataForUser(userId);
  const statusMap = deriveAgentStatus(data.logs);
  const skillsMap = deriveEquippedSkills(data.logs);
  const ordered = ["Shiva", "Brahma", "Vishnu", "Hanuman", "Lakshmi", "Nandi"];

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-semibold text-[var(--text)]">Agent Directory</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">Realtime operational states and equipped capabilities.</p>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        {ordered.map((agent) => (
          <article key={agent} className="rounded-xl border border-white/10 bg-[var(--panel)] p-4">
            <p className="font-semibold text-[var(--text)]">{agent}</p>
            <p className="mt-1 text-xs text-cyan-300">{statusMap[agent]?.state ?? "Idle"}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{statusMap[agent]?.message ?? "Awaiting campaign execution."}</p>
            <p className="mt-2 text-xs text-[var(--muted)]">
              Skills: {skillsMap[agent]?.join(", ") ?? "No installed skills captured yet"}
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}
