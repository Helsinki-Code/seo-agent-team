import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const createCampaignSchema = z.object({
  target: z.string().min(2)
});

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const orchestratorUrl =
    process.env.ORCHESTRATOR_INTERNAL_URL ??
    process.env.NEXT_PUBLIC_ORCHESTRATOR_URL ??
    "http://localhost:4000";
  const target = parsed.data.target.trim();
  const payload = target.startsWith("http://") || target.startsWith("https://")
    ? { targetUrl: target, userId }
    : { seedTopic: target, userId };

  const response = await fetch(`${orchestratorUrl}/campaigns`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    return NextResponse.json({ error: text }, { status: 500 });
  }

  const result = (await response.json()) as { campaignId: string };
  return NextResponse.json(result, { status: 201 });
}
