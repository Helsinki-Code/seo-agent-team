import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { RuntimeConfig } from "./config.js";
import type {
  AgentLogInput,
  CampaignContext,
  CampaignCreateInput,
  CampaignRecord,
  CampaignStatus
} from "./types.js";

export class Repository {
  private readonly supabase: SupabaseClient;

  constructor(config: RuntimeConfig) {
    this.supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });
  }

  async createCampaign(input: CampaignCreateInput): Promise<CampaignRecord> {
    const { data, error } = await this.supabase
      .from("campaigns")
      .insert({
        target_url: input.targetUrl ?? null,
        seed_topic: input.seedTopic ?? null,
        status: "queued",
        initiated_by: input.initiatedBy,
        user_id: input.userId ?? null
      })
      .select("id,target_url,seed_topic,status,initiated_by,user_id,created_at,updated_at")
      .single();

    if (error || !data) {
      throw new Error(`Failed to create campaign: ${error?.message ?? "Unknown error"}`);
    }

    return data as CampaignRecord;
  }

  async updateCampaignStatus(campaignId: string, status: CampaignStatus): Promise<void> {
    const { error } = await this.supabase
      .from("campaigns")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", campaignId);

    if (error) {
      throw new Error(`Failed to update campaign status: ${error.message}`);
    }
  }

  async promoteQueuedCampaign(campaignId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("campaigns")
      .update({ status: "running", updated_at: new Date().toISOString() })
      .eq("id", campaignId)
      .eq("status", "queued")
      .select("id");

    if (error) {
      throw new Error(`Failed to promote campaign status: ${error.message}`);
    }

    return Boolean(data && data.length > 0);
  }

  async listRunnableCampaigns(limit = 3): Promise<CampaignRecord[]> {
    const { data, error } = await this.supabase
      .from("campaigns")
      .select("id,target_url,seed_topic,status,initiated_by,user_id,created_at,updated_at")
      .in("status", ["queued", "running"])
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to list runnable campaigns: ${error.message}`);
    }

    return (data ?? []) as CampaignRecord[];
  }

  async getCampaign(campaignId: string): Promise<CampaignRecord | null> {
    const { data, error } = await this.supabase
      .from("campaigns")
      .select("id,target_url,seed_topic,status,initiated_by,user_id,created_at,updated_at")
      .eq("id", campaignId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch campaign: ${error.message}`);
    }

    return (data as CampaignRecord | null) ?? null;
  }

  async logAgentEvent(log: AgentLogInput): Promise<void> {
    const { error } = await this.supabase.from("agent_logs").insert({
      campaign_id: log.campaignId ?? null,
      agent_name: log.agentName,
      level: log.level ?? "info",
      state: log.state,
      message: log.message,
      payload: log.payload ?? {},
      skill_name: log.skillName ?? null,
      installed_skill_version: log.installedSkillVersion ?? null
    });

    if (error) {
      throw new Error(`Failed to write agent log: ${error.message}`);
    }
  }

  async logSafe(log: AgentLogInput): Promise<void> {
    try {
      await this.logAgentEvent(log);
    } catch (error) {
      console.error("Failed to persist agent log", error);
    }
  }

  async getLatestCycleContext(campaignId: string): Promise<CampaignContext | null> {
    const { data, error } = await this.supabase
      .from("agent_logs")
      .select("payload")
      .eq("campaign_id", campaignId)
      .eq("state", "cycle_context_snapshot")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load cycle context: ${error.message}`);
    }

    if (!data || typeof data.payload !== "object" || !data.payload) {
      return null;
    }

    return data.payload as CampaignContext;
  }

  async insertKeywordRecords(args: {
    campaignId: string;
    sourceAgent: string;
    keywords: Array<{ keyword: string; intent?: string; difficulty?: number; rankPosition?: number }>;
  }): Promise<void> {
    if (args.keywords.length === 0) {
      return;
    }

    const payload = args.keywords.map((keyword) => ({
      campaign_id: args.campaignId,
      keyword: keyword.keyword,
      intent: keyword.intent ?? null,
      difficulty: keyword.difficulty ?? null,
      rank_position: keyword.rankPosition ?? null,
      source_agent: args.sourceAgent
    }));

    const { error } = await this.supabase.from("keywords").insert(payload);
    if (error) {
      throw new Error(`Failed to insert keyword records: ${error.message}`);
    }
  }

  async insertContentRecord(args: {
    campaignId: string;
    title: string;
    slug: string;
    html: string;
    cmsTarget?: string;
    featuredImageUrl?: string;
    publishStatus?: "draft" | "scheduled" | "published" | "failed";
    publishedUrl?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const { error } = await this.supabase.from("content_pipeline").insert({
      campaign_id: args.campaignId,
      title: args.title,
      slug: args.slug,
      html_content: args.html,
      featured_image_url: args.featuredImageUrl ?? null,
      cms_target: args.cmsTarget ?? null,
      publish_status: args.publishStatus ?? "draft",
      published_url: args.publishedUrl ?? null,
      metadata: args.metadata ?? {}
    });

    if (error) {
      throw new Error(`Failed to insert content pipeline record: ${error.message}`);
    }
  }

  async insertOutreachRecords(args: {
    campaignId: string;
    records: Array<{
      prospectDomain: string;
      contactName?: string;
      contactEmail?: string;
      pitchSubject?: string;
      pitchBody?: string;
      outreachStatus?: "queued" | "sent" | "replied" | "won" | "lost";
      responseStatus?: string;
      metadata?: Record<string, unknown>;
    }>;
  }): Promise<void> {
    if (args.records.length === 0) {
      return;
    }

    const payload = args.records.map((record) => ({
      campaign_id: args.campaignId,
      prospect_domain: record.prospectDomain,
      contact_name: record.contactName ?? null,
      contact_email: record.contactEmail ?? null,
      pitch_subject: record.pitchSubject ?? null,
      pitch_body: record.pitchBody ?? null,
      outreach_status: record.outreachStatus ?? "queued",
      response_status: record.responseStatus ?? null,
      metadata: record.metadata ?? {}
    }));

    const { error } = await this.supabase.from("backlink_outreach").insert(payload);
    if (error) {
      throw new Error(`Failed to insert outreach records: ${error.message}`);
    }
  }

  async getUserIntegration(userId: string, provider: string, label = "default"): Promise<{
    encryptedSecret: string;
    status: string;
  } | null> {
    const { data, error } = await this.supabase
      .from("user_integrations")
      .select("encrypted_secret,status")
      .eq("user_id", userId)
      .eq("provider", provider)
      .eq("label", label)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to read user integration: ${error.message}`);
    }
    if (!data) {
      return null;
    }

    return {
      encryptedSecret: data.encrypted_secret as string,
      status: data.status as string
    };
  }

  async ensureCredentialRequest(args: {
    userId: string;
    provider: string;
    requestedByAgent: string;
    reason: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const { data, error } = await this.supabase
      .from("credential_requests")
      .select("id")
      .eq("user_id", args.userId)
      .eq("provider", args.provider)
      .eq("status", "pending")
      .limit(1);

    if (error) {
      throw new Error(`Failed to query credential requests: ${error.message}`);
    }

    if (data && data.length > 0) {
      return;
    }

    const { error: insertError } = await this.supabase.from("credential_requests").insert({
      user_id: args.userId,
      provider: args.provider,
      requested_by_agent: args.requestedByAgent,
      reason: args.reason,
      status: "pending",
      metadata: args.metadata ?? {}
    });

    if (insertError) {
      throw new Error(`Failed to create credential request: ${insertError.message}`);
    }
  }
}
