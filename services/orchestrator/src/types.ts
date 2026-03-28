export type CampaignStatus = "queued" | "running" | "completed" | "failed";

export type CampaignCreateInput = {
  targetUrl?: string;
  seedTopic?: string;
  initiatedBy: "telegram" | "web" | "system";
  userId?: string;
};

export type CampaignRecord = {
  id: string;
  target_url: string | null;
  seed_topic: string | null;
  status: CampaignStatus;
  initiated_by: string;
  user_id?: string | null;
  created_at: string;
  updated_at?: string;
};

export type AgentLogLevel = "info" | "warn" | "error";

export type AgentLogInput = {
  campaignId?: string;
  agentName: string;
  level?: AgentLogLevel;
  state: string;
  message: string;
  payload?: Record<string, unknown>;
  skillName?: string;
  installedSkillVersion?: string;
};

export type SkillCandidate = {
  name: string;
  slug: string;
  description: string;
  installCommand?: string;
  source: "json" | "text";
  raw?: Record<string, unknown> | string;
};

export type InstalledSkill = {
  skill: SkillCandidate;
  command: string;
  stdout: string;
  stderr: string;
  requiredProviders?: string[];
};

export type CampaignContext = {
  campaignId: string;
  targetUrl?: string;
  seedTopic?: string;
  cycle: number;
  strategy?: Record<string, unknown>;
  keywords?: Record<string, unknown>;
  content?: Record<string, unknown>;
  technical?: Record<string, unknown>;
  outreach?: Record<string, unknown>;
  analytics?: Record<string, unknown>;
  [key: string]: unknown;
};

export type AgentHandoff = {
  campaignId: string;
  cycle: number;
  from: string;
  to: string;
  timestamp: string;
  data: Record<string, unknown>;
};
