"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";

export function StartCampaignForm() {
  const [target, setTarget] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text);
      }

      const payload = (await response.json()) as { campaignId: string };
      setStatus(`Campaign created: ${payload.campaignId}`);
      setTarget("");
    } catch (error) {
      setStatus(
        error instanceof Error ? `Failed to start campaign: ${error.message}` : "Failed to start campaign."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function onTargetChange(event: ChangeEvent<HTMLInputElement>) {
    setTarget((event.target as HTMLInputElement).value);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
      <label className="block text-sm font-semibold text-[var(--text)]">
        Target URL or Seed Topic
      </label>
      <input
        required
        value={target}
        onChange={onTargetChange}
        placeholder="https://example.com or best espresso machines"
        className="w-full rounded-md border border-white/20 bg-black/30 px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-cyan-300"
      />
      <button
        disabled={submitting}
        type="submit"
        className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Launching..." : "Start Campaign"}
      </button>
      {status ? <p className="text-xs text-[var(--muted)]">{status}</p> : null}
    </form>
  );
}
