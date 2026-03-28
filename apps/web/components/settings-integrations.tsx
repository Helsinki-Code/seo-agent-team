"use client";

import { useEffect, useMemo, useState } from "react";
import type { IntegrationProviderConfig } from "../lib/integration-catalog";

type IntegrationRow = {
  id: string;
  provider: string;
  label: string;
  status: string;
  lastFour: string | null;
  config: Record<string, unknown>;
  connectedFields: string[];
  validationMessage: string | null;
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
  catalog: IntegrationProviderConfig[];
  integrations: IntegrationRow[];
  credentialRequests: CredentialRequest[];
};

export function SettingsIntegrations() {
  const [provider, setProvider] = useState("anthropic");
  const [label, setLabel] = useState("default");
  const [values, setValues] = useState<Record<string, string>>({});
  const [validateConnection, setValidateConnection] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [data, setData] = useState<IntegrationsResponse>({
    catalog: [],
    integrations: [],
    credentialRequests: []
  });

  const selectedProvider = useMemo(
    () => data.catalog.find((item) => item.id === provider),
    [data.catalog, provider]
  );

  async function loadIntegrations() {
    try {
      const response = await fetch("/api/integrations");
      const payload = (await response.json()) as IntegrationsResponse | { error: string };
      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "Failed to load integrations");
      }
      setData(payload);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load integrations.");
    }
  }

  useEffect(() => {
    void loadIntegrations();
  }, []);

  useEffect(() => {
    setValues({});
  }, [provider]);

  function updateValue(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

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
          values,
          validateConnection
        })
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        validationMessage?: string;
      };
      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "Could not save integration.");
      }

      setValues({});
      setStatus(payload.validationMessage ?? "Integration saved.");
      await loadIntegrations();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save integration.");
    } finally {
      setSaving(false);
    }
  }

  function loadFromCredentialRequest(request: CredentialRequest) {
    setProvider(request.provider);
    setStatus(`Loaded request from ${request.requested_by_agent}. Complete required fields to resolve it.`);
  }

  return (
    <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 xl:grid-cols-[1.2fr_1fr]">
      <section className="rounded-2xl border border-white/10 bg-[var(--panel)] p-5">
        <h1 className="text-2xl font-semibold text-[var(--text)]">API Keys and Integrations</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Keys are encrypted server-side and never returned to the frontend after save.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <label className="block text-sm text-[var(--muted)]">
            Provider
            <select
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm text-[var(--text)]"
            >
              {data.catalog.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
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

          {selectedProvider ? (
            <article className="rounded-xl border border-cyan-400/30 bg-cyan-400/5 p-3">
              <p className="text-sm font-semibold text-cyan-200">{selectedProvider.label}</p>
              <p className="mt-1 text-xs text-cyan-100/90">{selectedProvider.shortDescription}</p>
              <a
                href={selectedProvider.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-xs text-cyan-300 underline"
              >
                Open docs for key setup
              </a>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-cyan-100/90">
                {selectedProvider.setupSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </article>
          ) : null}

          <div className="grid gap-3">
            {selectedProvider?.fields.map((field) => (
              <label key={field.key} className="block text-sm text-[var(--muted)]">
                {field.label}
                {field.required ? <span className="text-rose-300"> *</span> : null}
                {field.type === "textarea" ? (
                  <textarea
                    value={values[field.key] ?? ""}
                    onChange={(event) => updateValue(field.key, event.target.value)}
                    className="mt-1 min-h-28 w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm text-[var(--text)]"
                    placeholder={field.placeholder}
                    required={field.required}
                  />
                ) : (
                  <input
                    value={values[field.key] ?? ""}
                    onChange={(event) => updateValue(field.key, event.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm text-[var(--text)]"
                    placeholder={field.placeholder}
                    required={field.required}
                    type={field.type === "password" ? "password" : "text"}
                  />
                )}
                {field.helper ? <p className="mt-1 text-xs text-[var(--muted)]">{field.helper}</p> : null}
              </label>
            ))}
          </div>

          <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <input
              type="checkbox"
              checked={validateConnection}
              onChange={(event) => setValidateConnection(event.target.checked)}
            />
            Validate connection before saving
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
                {integration.validationMessage ? (
                  <p className="text-xs text-cyan-300">{integration.validationMessage}</p>
                ) : null}
              </div>
            ))}
            {data.integrations.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No integrations connected yet.</p>
            ) : null}
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
                {request.status === "pending" ? (
                  <button
                    type="button"
                    onClick={() => loadFromCredentialRequest(request)}
                    className="mt-2 rounded-md border border-cyan-400/40 px-2 py-1 text-xs text-cyan-200"
                  >
                    Configure this provider
                  </button>
                ) : null}
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
