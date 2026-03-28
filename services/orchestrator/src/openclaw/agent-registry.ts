import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

const agentSkillPolicySchema = z.object({
  dynamic_discovery_required: z.literal(true),
  never_hardcode_skill_slugs: z.literal(true),
  discovery_workflow: z.array(z.string()).min(1),
  target_capabilities: z.array(z.string()).min(1)
});

const handoffContractSchema = z.object({
  input: z.array(z.string()).min(1),
  output: z.array(z.string()).min(1)
});

const schedulePolicySchema = z
  .object({
    monitoring_cadence: z.string().min(1),
    alert_threshold: z.string().min(1)
  })
  .optional();

const agentProfileSchema = z.object({
  id: z.string().min(2),
  name: z.string().min(2),
  title: z.string().min(2),
  goal: z.string().min(10),
  directive: z.string().min(10),
  autonomy_mode: z.enum(["full"]),
  required_tools: z.array(z.literal("Skill_Discover_And_Install")).min(1),
  skill_policy: agentSkillPolicySchema,
  responsibilities: z.array(z.string()).min(1),
  handoff_contract: handoffContractSchema,
  schedule_policy: schedulePolicySchema
});

const routeMapEntrySchema = z.object({
  from: z.string().min(2),
  to: z.string().min(2),
  reason: z.string().min(3)
});

const teamManifestSchema = z.object({
  team_name: z.string().min(3),
  entry_agent: z.string().min(2),
  agents: z.array(z.string()).min(1),
  collaboration_policy: z.object({
    execution_mode: z.string().min(2),
    handoff_format: z.literal("json"),
    always_log_to_agent_logs: z.boolean()
  }),
  phase2_focus: z.array(z.string()).min(1),
  route_map: z.array(routeMapEntrySchema).min(1)
});

export type AgentProfile = z.infer<typeof agentProfileSchema>;
export type TeamManifest = z.infer<typeof teamManifestSchema>;

export class AgentRegistry {
  constructor(private readonly openclawDir: string) {}

  async loadAgents(): Promise<AgentProfile[]> {
    const agentsDir = join(this.openclawDir, "agents");
    const entries = await readdir(agentsDir, { withFileTypes: true });
    const jsonFiles = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => entry.name)
      .sort();

    const agents: AgentProfile[] = [];

    for (const fileName of jsonFiles) {
      const raw = await readFile(join(agentsDir, fileName), "utf8");
      const parsed = agentProfileSchema.parse(JSON.parse(raw));
      agents.push(parsed);
    }

    return agents;
  }

  async loadTeamManifest(): Promise<TeamManifest> {
    const manifestPath = join(this.openclawDir, "team.phase2.json");
    const raw = await readFile(manifestPath, "utf8");
    return teamManifestSchema.parse(JSON.parse(raw));
  }
}
