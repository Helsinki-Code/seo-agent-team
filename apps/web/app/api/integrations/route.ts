import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { encryptSecret } from "../../../lib/crypto";
import { getProviderConfig, INTEGRATION_CATALOG } from "../../../lib/integration-catalog";
import { getSupabaseServerClient } from "../../../lib/supabase-server";

const saveIntegrationSchema = z.object({
  provider: z.string().min(2),
  label: z.string().min(1).default("default"),
  values: z.record(z.string()).default({}),
  validateConnection: z.boolean().optional()
});

type ConnectionValidationResult = {
  ok: boolean;
  message: string;
};

function splitSecretAndConfig(provider: string, values: Record<string, string>) {
  const providerConfig = getProviderConfig(provider);
  if (!providerConfig) {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  const secrets: Record<string, string> = {};
  const config: Record<string, string> = {};
  const missingRequired: string[] = [];

  for (const field of providerConfig.fields) {
    const raw = values[field.key];
    const value = typeof raw === "string" ? raw.trim() : "";

    if (field.required && !value) {
      missingRequired.push(field.label);
      continue;
    }

    if (!value) {
      continue;
    }

    if (field.secret) {
      secrets[field.key] = value;
    } else {
      config[field.key] = value;
    }
  }

  if (missingRequired.length > 0) {
    throw new Error(`Missing required field(s): ${missingRequired.join(", ")}`);
  }

  if (provider === "custom" && secrets.secret_json) {
    try {
      const parsed = JSON.parse(secrets.secret_json);
      if (!parsed || typeof parsed !== "object") {
        throw new Error("Custom secret JSON must be an object.");
      }
    } catch (error) {
      throw new Error(
        error instanceof Error ? `Invalid custom secret JSON: ${error.message}` : "Invalid custom secret JSON."
      );
    }
  }

  return { providerConfig, secrets, config };
}

async function validateProviderConnection(
  provider: string,
  secrets: Record<string, string>,
  config: Record<string, string>
): Promise<ConnectionValidationResult> {
  if (provider === "anthropic") {
    const key = secrets.api_key;
    if (!key) {
      return { ok: false, message: "Anthropic API key is required." };
    }
    const response = await fetch("https://api.anthropic.com/v1/models", {
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01"
      }
    });
    if (!response.ok) {
      const body = await response.text();
      return { ok: false, message: `Anthropic validation failed (${response.status}): ${body.slice(0, 180)}` };
    }
    return { ok: true, message: "Anthropic connection validated." };
  }

  if (provider === "telegram_bot") {
    const token = secrets.bot_token;
    if (!token) {
      return { ok: false, message: "Telegram bot token is required." };
    }
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const payload = (await response.json()) as { ok?: boolean };
    if (!payload.ok) {
      return { ok: false, message: "Telegram getMe check failed. Verify bot token." };
    }
    return { ok: true, message: "Telegram bot token validated." };
  }

  if (provider === "wordpress") {
    const siteUrl = config.site_url;
    const username = config.username;
    const appPassword = secrets.app_password;
    if (!siteUrl || !username || !appPassword) {
      return { ok: false, message: "WordPress site URL, username, and app password are required." };
    }
    const authHeader = Buffer.from(`${username}:${appPassword}`).toString("base64");
    const response = await fetch(`${siteUrl.replace(/\/+$/, "")}/wp-json/wp/v2/users/me`, {
      headers: {
        Authorization: `Basic ${authHeader}`
      }
    });
    if (!response.ok) {
      const body = await response.text();
      return { ok: false, message: `WordPress validation failed (${response.status}): ${body.slice(0, 180)}` };
    }
    return { ok: true, message: "WordPress connection validated." };
  }

  if (provider === "webflow") {
    const token = secrets.api_token;
    const siteId = config.site_id;
    if (!token || !siteId) {
      return { ok: false, message: "Webflow API token and site ID are required." };
    }
    const response = await fetch(`https://api.webflow.com/v2/sites/${siteId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    if (!response.ok) {
      const body = await response.text();
      return { ok: false, message: `Webflow validation failed (${response.status}): ${body.slice(0, 180)}` };
    }
    return { ok: true, message: "Webflow connection validated." };
  }

  if (provider === "gsc") {
    const json = secrets.service_account_json;
    const propertyUrl = config.property_url;
    if (!json || !propertyUrl) {
      return { ok: false, message: "GSC service account JSON and property URL are required." };
    }
    try {
      const parsed = JSON.parse(json) as Record<string, unknown>;
      if (!parsed.client_email || !parsed.private_key) {
        return { ok: false, message: "Service account JSON must include client_email and private_key." };
      }
    } catch {
      return { ok: false, message: "Invalid service account JSON format." };
    }
    return { ok: true, message: "GSC credential structure validated." };
  }

  if (provider === "email_provider") {
    const apiKey = secrets.api_key;
    const fromEmail = config.from_email;
    if (!apiKey || !fromEmail) {
      return { ok: false, message: "Email provider key and from email are required." };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) {
      return { ok: false, message: "From email format appears invalid." };
    }
    return { ok: true, message: "Email provider credentials saved (manual provider validation)." };
  }

  if (provider === "bfl_flux") {
    const apiKey = secrets.api_key;
    if (!apiKey) {
      return { ok: false, message: "BFL Flux API key is required." };
    }
    return { ok: true, message: "BFL Flux key saved (manual provider validation)." };
  }

  return { ok: true, message: "Saved without provider connectivity test." };
}

function maskMetadata(secrets: Record<string, string>) {
  const first = Object.values(secrets)[0];
  return {
    last_four: first ? first.slice(-4) : null
  };
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  const [{ data: integrations, error: integrationsError }, { data: requests, error: requestsError }] =
    await Promise.all([
      supabase
        .from("user_integrations")
        .select("id,provider,label,status,metadata,last_validated_at,updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false }),
      supabase
        .from("credential_requests")
        .select("id,provider,requested_by_agent,reason,status,metadata,created_at,resolved_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
    ]);

  if (integrationsError || requestsError) {
    return NextResponse.json(
      {
        error: integrationsError?.message ?? requestsError?.message ?? "Failed to load integrations"
      },
      { status: 500 }
    );
  }

  const sanitized = (integrations ?? []).map((item) => {
    const metadata = (item.metadata ?? {}) as Record<string, unknown>;
    return {
      id: item.id,
      provider: item.provider,
      label: item.label,
      status: item.status,
      lastFour: typeof metadata.last_four === "string" ? metadata.last_four : null,
      config: typeof metadata.config === "object" && metadata.config ? metadata.config : {},
      connectedFields:
        Array.isArray(metadata.connected_fields) &&
        metadata.connected_fields.every((entry) => typeof entry === "string")
          ? metadata.connected_fields
          : [],
      validationMessage:
        typeof metadata.validation_message === "string" ? metadata.validation_message : null,
      updatedAt: item.updated_at,
      lastValidatedAt: item.last_validated_at
    };
  });

  return NextResponse.json({
    catalog: INTEGRATION_CATALOG,
    integrations: sanitized,
    credentialRequests: requests ?? []
  });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = saveIntegrationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const provider = parsed.data.provider.trim().toLowerCase();
    const label = parsed.data.label.trim();
    const { providerConfig, secrets, config } = splitSecretAndConfig(provider, parsed.data.values);
    const validation = parsed.data.validateConnection
      ? await validateProviderConnection(provider, secrets, config)
      : { ok: true, message: "Saved without live validation." };

    if (!validation.ok) {
      return NextResponse.json({ error: validation.message }, { status: 400 });
    }

    const encryptedSecret = encryptSecret(JSON.stringify(secrets));
    const metadata = {
      ...maskMetadata(secrets),
      provider_label: providerConfig.label,
      config,
      connected_fields: Object.keys(parsed.data.values).filter((key) => {
        const value = parsed.data.values[key];
        return typeof value === "string" && value.trim().length > 0;
      }),
      validation_message: validation.message
    };

    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("user_integrations").upsert(
      {
        user_id: userId,
        provider,
        label,
        encrypted_secret: encryptedSecret,
        status: "active",
        metadata,
        last_validated_at: new Date().toISOString()
      },
      {
        onConflict: "user_id,provider,label"
      }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase
      .from("credential_requests")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString()
      })
      .eq("user_id", userId)
      .eq("provider", provider)
      .eq("status", "pending");

    const { data: campaignsToResume } = await supabase
      .from("campaigns")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "running")
      .order("updated_at", { ascending: false })
      .limit(3);

    const orchestratorUrl =
      process.env.ORCHESTRATOR_INTERNAL_URL ??
      process.env.NEXT_PUBLIC_ORCHESTRATOR_URL ??
      "http://localhost:4000";
    if (campaignsToResume && campaignsToResume.length > 0) {
      await Promise.allSettled(
        campaignsToResume.map((campaign) =>
          fetch(`${orchestratorUrl}/campaigns/${campaign.id}/trigger`, {
            method: "POST"
          })
        )
      );
    }

    return NextResponse.json({
      ok: true,
      validationMessage: validation.message
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to save integration."
      },
      { status: 500 }
    );
  }
}
