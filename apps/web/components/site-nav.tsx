"use client";

import Link from "next/link";
import { SignInButton, SignUpButton, UserButton, useAuth } from "@clerk/nextjs";
import { ThemeToggleOrb } from "./theme-toggle-orb";

export function SiteNav() {
  const { isSignedIn } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[var(--bg)]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-4">
        <Link href="/" className="text-xl font-semibold tracking-tight text-[var(--text)]">
          SEO Command Center
        </Link>
        <nav className="flex items-center gap-3">
          <Link href="/dashboard" className="rounded-md px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--text)]">
            Dashboard
          </Link>
          <Link href="/campaigns" className="rounded-md px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--text)]">
            Campaigns
          </Link>
          <Link href="/agents" className="rounded-md px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--text)]">
            Agents
          </Link>
          <Link href="/seo-office" className="rounded-md px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--text)]">
            SEO Office
          </Link>
          <Link href="/settings" className="rounded-md px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--text)]">
            Settings
          </Link>
          <ThemeToggleOrb />
          {!isSignedIn ? (
            <>
              <SignInButton mode="modal">
                <button className="rounded-md border border-white/20 px-3 py-2 text-sm text-[var(--text)]">Sign In</button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-slate-950">
                  Get Started
                </button>
              </SignUpButton>
            </>
          ) : (
            <UserButton />
          )}
        </nav>
      </div>
    </header>
  );
}
