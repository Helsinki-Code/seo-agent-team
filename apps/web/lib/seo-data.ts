export type CampaignRow = {
  id: string;
  user_id: string | null;
  target_url: string | null;
  seed_topic: string | null;
  status: string;
  created_at: string;
};

export type KeywordRow = {
  id: string;
  campaign_id: string;
  keyword: string;
  intent: string | null;
  difficulty: number | null;
  rank_position: number | null;
  created_at: string;
};

export type ContentRow = {
  id: string;
  campaign_id: string;
  title: string;
  slug: string;
  publish_status: string;
  published_url: string | null;
  created_at: string;
};

export type OutreachRow = {
  id: string;
  campaign_id: string;
  prospect_domain: string;
  outreach_status: string;
  contact_email: string | null;
  created_at: string;
};

export type AgentLogRow = {
  id: number;
  campaign_id: string | null;
  agent_name: string;
  state: string;
  message: string;
  skill_name: string | null;
  created_at: string;
};

export type DashboardPayload = {
  campaigns: CampaignRow[];
  keywords: KeywordRow[];
  content: ContentRow[];
  outreach: OutreachRow[];
  logs: AgentLogRow[];
};

export type AgentRealtimeStatus = {
  agentName: string;
  state: string;
  message: string;
  skill: string | null;
  updatedAt: string;
};

const SEARCH_STATES = new Set(["searching_for_skill", "installing_skill"]);
const ACTIVE_STATES = new Set(["executing_task"]);

export function deriveAgentStatus(logs: AgentLogRow[]): Record<string, AgentRealtimeStatus> {
  const sorted = [...logs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const statusMap: Record<string, AgentRealtimeStatus> = {};

  for (const log of sorted) {
    if (statusMap[log.agent_name]) {
      continue;
    }

    let stateLabel = "Idle";
    if (SEARCH_STATES.has(log.state)) {
      stateLabel = "Searching Database";
    } else if (ACTIVE_STATES.has(log.state)) {
      stateLabel = log.agent_name.toLowerCase() === "vishnu" ? "Active / Generating Media" : "Active / Executing Task";
    } else if (log.state === "task_completed") {
      stateLabel = "Idle / Complete";
    }

    statusMap[log.agent_name] = {
      agentName: log.agent_name,
      state: stateLabel,
      message: log.message,
      skill: log.skill_name,
      updatedAt: log.created_at
    };
  }

  return statusMap;
}

export function deriveEquippedSkills(logs: AgentLogRow[]): Record<string, string[]> {
  const skillsByAgent: Record<string, Set<string>> = {};
  for (const log of logs) {
    if (!log.skill_name) {
      continue;
    }
    if (!skillsByAgent[log.agent_name]) {
      skillsByAgent[log.agent_name] = new Set<string>();
    }
    const agentSkills = skillsByAgent[log.agent_name];
    if (agentSkills) {
      agentSkills.add(log.skill_name);
    }
  }

  return Object.fromEntries(
    Object.entries(skillsByAgent).map(([agent, skills]) => [agent, [...skills].slice(0, 5)])
  );
}
