import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { encryptSecret } from "../../../lib/crypto";
import { getSupabaseServerClient } from "../../../lib/supabase-server";

const saveIntegrationSchema = z.object({
  provider: z.string().min(2),
  label: z.string().min(1).default("default"),
  secret: z.string().min(10)
});

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
      updatedAt: item.updated_at,
      lastValidatedAt: item.last_validated_at
    };
  });

  return NextResponse.json({
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

  const secret = parsed.data.secret.trim();
  const encryptedSecret = encryptSecret(secret);
  const lastFour = secret.slice(-4);
  const supabase = getSupabaseServerClient();

  const { error } = await supabase.from("user_integrations").upsert(
    {
      user_id: userId,
      provider: parsed.data.provider.trim().toLowerCase(),
      label: parsed.data.label.trim(),
      encrypted_secret: encryptedSecret,
      status: "active",
      metadata: {
        last_four: lastFour
      },
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
    .eq("provider", parsed.data.provider.trim().toLowerCase())
    .eq("status", "pending");

  return NextResponse.json({ ok: true });
}
