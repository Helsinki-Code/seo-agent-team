import Link from "next/link";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";

export default async function LandingPage() {
  const { userId } = await auth();
  const isSignedIn = Boolean(userId);

  return (
    <main className="relative overflow-hidden">
      <section className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-7xl items-center gap-8 px-4 py-16 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <p className="inline-flex rounded-full border border-cyan-300/40 bg-cyan-400/10 px-4 py-1 text-xs tracking-[0.2em] text-cyan-200">
            AUTONOMOUS SEO SYSTEM
          </p>
          <h1 className="text-4xl font-semibold leading-tight text-[var(--text)] md:text-6xl">
            Build, rank, publish, and optimize with a live AI SEO command center.
          </h1>
          <p className="max-w-2xl text-base text-[var(--muted)] md:text-lg">
            One input launches your full agent team: SERP research, content generation, technical audits,
            outreach, and ranking intelligence in one continuous loop.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {!isSignedIn ? (
              <>
                <SignUpButton mode="modal">
                  <button className="rounded-lg bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-slate-950">
                    Start Free
                  </button>
                </SignUpButton>
                <SignInButton mode="modal">
                  <button className="rounded-lg border border-white/20 px-5 py-3 text-sm font-semibold text-[var(--text)]">
                    Sign In
                  </button>
                </SignInButton>
              </>
            ) : (
              <Link href="/dashboard" className="rounded-lg bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-slate-950">
                Open Dashboard
              </Link>
            )}
            <Link href="/seo-office" className="rounded-lg border border-white/20 px-5 py-3 text-sm font-semibold text-[var(--text)]">
              View 3D Office
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[var(--panel)] p-5 shadow-[0_25px_70px_rgba(0,0,0,0.35)]">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--text)]">What runs automatically</h2>
            {[
              "Shiva orchestrates strategy and routing",
              "Brahma extracts SERP + keyword opportunities",
              "Vishnu writes and publishes rich content",
              "Hanuman fixes technical SEO blockers",
              "Lakshmi executes personalized outreach",
              "Nandi tracks rankings and decay alerts"
            ].map((item) => (
              <article key={item} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-[var(--muted)]">
                {item}
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
