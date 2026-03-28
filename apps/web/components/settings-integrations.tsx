"use client";

import { useEffect, useState } from "react";

type IntegrationRow = {
  id: string;
  provider: string;
  label: string;
  status: string;
  lastFour: string | null;
  updatedAt: string;
  lastValidatedAt: string | null;
};

type CredentialRequest = {
  id: string;
  provider: string;
  requested_by_agent: string;
  reason: string;
  status: string;
  created_at: string;
};

type IntegrationsResponse = {
  integrations: IntegrationRow[];
  credentialRequests: CredentialRequest[];
};

export function SettingsIntegrations() {
  const [provider, setProvider] = useState("anthropic");
  const [label, setLabel] = useState("default");
  const [secret, setSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [data, setData] = useState<IntegrationsResponse>({ integrations: [], credentialRequests: [] });

  async function loadIntegrations() {
    const response = await fetch("/api/integrations");
    const payload = (await response.json()) as IntegrationsResponse | { error: string };
    if (!response.ok || "error" in payload) {
      throw new Error("error" in payload ? payload.error : "Failed to load integrations");
    }
    setData(payload);
  }

  useEffect(() => {
    void loadIntegrations();
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch("/api/integrations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider,
          label,
          secret
        })
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "Could not save integration.");
      }

      setSecret("");
      setStatus("API key saved and encrypted successfully.");
      await loadIntegrations();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save integration.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 xl:grid-cols-[1fr_1fr]">
      <section className="rounded-2xl border border-white/10 bg-[var(--panel)] p-5">
        <h1 className="text-2xl font-semibold text-[var(--text)]">API Keys & Integrations</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Keys are encrypted server-side and never returned to the frontend after save.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <label className="block text-sm text-[var(--muted)]">
            Provider
            <select
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm text-[var(--text)]"
            >
              <option value="anthropic">Anthropic</option>
              <option value="telegram_bot">Telegram Bot</option>
              <option value="wordpress">WordPress</option>
              <option value="webflow">Webflow</option>
              <option value="gsc">Google Search Console</option>
              <option value="custom">Custom Provider</option>
            </select>
          </label>

          <label className="block text-sm text-[var(--muted)]">
            Label
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm text-[var(--text)]"
              placeholder="default"
            />
          </label>

          <label className="block text-sm text-[var(--muted)]">
            Secret Key
            <input
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm text-[var(--text)]"
              placeholder="Paste key..."
              required
            />
          </label>

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Integration"}
          </button>
          {status ? <p className="text-sm text-[var(--muted)]">{status}</p> : null}
        </form>
      </section>

      <section className="space-y-6">
        <article className="rounded-2xl border border-white/10 bg-[var(--panel)] p-5">
          <h2 className="text-lg font-semibold text-[var(--text)]">Connected Integrations</h2>
          <div className="mt-3 space-y-2">
            {data.integrations.map((integration) => (
              <div key={integration.id} className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm">
                <p className="font-semibold text-[var(--text)]">
                  {integration.provider} · {integration.label}
                </p>
                <p className="text-xs text-[var(--muted)]">Status: {integration.status}</p>
                <p className="text-xs text-[var(--muted)]">
                  Key: {integration.lastFour ? `••••${integration.lastFour}` : "stored securely"}
                </p>
              </div>
            ))}
            {data.integrations.length === 0 ? <p className="text-sm text-[var(--muted)]">No integrations connected yet.</p> : null}
          </div>
        </article>

        <article className="rounded-2xl border border-white/10 bg-[var(--panel)] p-5">
          <h2 className="text-lg font-semibold text-[var(--text)]">Credential Requests From Agents</h2>
          <div className="mt-3 space-y-2">
            {data.credentialRequests.map((request) => (
              <div key={request.id} className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm">
                <p className="font-semibold text-[var(--text)]">{request.provider}</p>
                <p className="text-xs text-[var(--muted)]">Requested by: {request.requested_by_agent}</p>
                <p className="text-xs text-[var(--muted)]">{request.reason}</p>
                <p className="text-xs text-cyan-300">Status: {request.status}</p>
              </div>
            ))}
            {data.credentialRequests.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No pending credential requests.</p>
            ) : null}
          </div>
        </article>
      </section>
    </main>
  );
}
