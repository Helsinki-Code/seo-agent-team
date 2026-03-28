import { getSupabaseServerClient } from "./supabase-server";
import type { DashboardPayload } from "./seo-data";

export async function getDashboardDataForUser(userId: string): Promise<DashboardPayload> {
  const supabase = getSupabaseServerClient();
  const { data: campaigns, error: campaignError } = await supabase
    .from("campaigns")
    .select("id,user_id,target_url,seed_topic,status,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (campaignError) {
    throw new Error(`Failed to load campaigns: ${campaignError.message}`);
  }

  const campaignIds = (campaigns ?? []).map((campaign) => campaign.id as string);
  if (campaignIds.length === 0) {
    return {
      campaigns: (campaigns ?? []) as DashboardPayload["campaigns"],
      keywords: [],
      content: [],
      outreach: [],
      logs: [],
      credentialRequests: []
    };
  }

  const [keywordsResult, contentResult, outreachResult, logsResult, requestsResult] = await Promise.all([
    supabase
      .from("keywords")
      .select("id,campaign_id,keyword,intent,difficulty,rank_position,created_at")
      .in("campaign_id", campaignIds)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("content_pipeline")
      .select("id,campaign_id,title,slug,publish_status,published_url,created_at")
      .in("campaign_id", campaignIds)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("backlink_outreach")
      .select("id,campaign_id,prospect_domain,outreach_status,contact_email,created_at")
      .in("campaign_id", campaignIds)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("agent_logs")
      .select("id,campaign_id,agent_name,state,message,skill_name,created_at")
      .in("campaign_id", campaignIds)
      .order("created_at", { ascending: false })
      .limit(120),
    supabase
      .from("credential_requests")
      .select("id,user_id,provider,requested_by_agent,reason,status,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(40)
  ]);

  const error =
    keywordsResult.error ??
    contentResult.error ??
    outreachResult.error ??
    logsResult.error ??
    requestsResult.error;
  if (error) {
    throw new Error(`Failed to load dashboard data: ${error.message}`);
  }

  return {
    campaigns: (campaigns ?? []) as DashboardPayload["campaigns"],
    keywords: (keywordsResult.data ?? []) as DashboardPayload["keywords"],
    content: (contentResult.data ?? []) as DashboardPayload["content"],
    outreach: (outreachResult.data ?? []) as DashboardPayload["outreach"],
    logs: (logsResult.data ?? []) as DashboardPayload["logs"],
    credentialRequests: (requestsResult.data ?? []) as DashboardPayload["credentialRequests"]
  };
}
