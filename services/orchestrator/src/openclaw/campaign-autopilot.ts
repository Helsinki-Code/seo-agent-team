import type { RuntimeConfig } from "../config.js";
import type { Repository } from "../repository.js";
import type { AgentHandoff, CampaignContext, CampaignRecord } from "../types.js";
import type { SkillDiscoverAndInstallTool } from "../tools/skill-discover-install.js";
import type { AgentProfile, TeamManifest } from "./agent-registry.js";
import { AnthropicClient, type AgentExecutionOutput } from "./anthropic-client.js";
import { decryptStoredSecret } from "../security/credential-crypto.js";

class CredentialPendingError extends Error {
  constructor(
    readonly provider: string,
    message: string
  ) {
    super(message);
    this.name = "CredentialPendingError";
  }
}

export class CampaignAutopilot {
  private readonly agentMap: Map<string, AgentProfile>;
  private readonly activeCampaigns = new Set<string>();
  private readonly lastCycleAt = new Map<string, number>();
  private timer: NodeJS.Timeout | null = null;
  private polling = false;

  constructor(
    private readonly config: RuntimeConfig,
    private readonly repository: Repository,
    private readonly skillTool: SkillDiscoverAndInstallTool,
    private readonly anthropic: AnthropicClient,
    agentProfiles: AgentProfile[],
    private readonly teamManifest: TeamManifest
  ) {
    this.agentMap = new Map(agentProfiles.map((agent) => [agent.id, agent]));
  }

  start(): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      void this.tick();
    }, this.config.AUTOPILOT_POLL_MS);

    void this.repository.logSafe({
      agentName: "Shiva",
      state: "autopilot_loop_started",
      message: `Autopilot loop started with poll ${this.config.AUTOPILOT_POLL_MS}ms and cycle interval ${this.config.AUTOPILOT_CYCLE_INTERVAL_MS}ms.`
    });

    void this.tick();
  }

  stop(): void {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
  }

  getStatus() {
    return {
      running: Boolean(this.timer),
      activeCampaigns: [...this.activeCampaigns],
      pollMs: this.config.AUTOPILOT_POLL_MS,
      cycleIntervalMs: this.config.AUTOPILOT_CYCLE_INTERVAL_MS
    };
  }

  async triggerCampaignNow(campaignId: string): Promise<void> {
    const campaign = await this.repository.getCampaign(campaignId);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} was not found.`);
    }

    await this.runCampaignCycle(campaign);
  }

  private async tick(): Promise<void> {
    if (this.polling) {
      return;
    }

    this.polling = true;
    try {
      const campaigns = await this.repository.listRunnableCampaigns(this.config.AUTOPILOT_BATCH_SIZE);
      for (const campaign of campaigns) {
        if (this.activeCampaigns.has(campaign.id)) {
          continue;
        }
        if (campaign.status === "running" && !this.isCycleDue(campaign.id)) {
          continue;
        }
        await this.runCampaignCycle(campaign);
      }
    } catch (error) {
      await this.repository.logSafe({
        agentName: "Shiva",
        level: "error",
        state: "autopilot_tick_failed",
        message: error instanceof Error ? error.message : "Unknown autopilot loop failure."
      });
    } finally {
      this.polling = false;
    }
  }

  private isCycleDue(campaignId: string): boolean {
    const previous = this.lastCycleAt.get(campaignId);
    if (!previous) {
      return true;
    }

    return Date.now() - previous >= this.config.AUTOPILOT_CYCLE_INTERVAL_MS;
  }

  private async runCampaignCycle(campaign: CampaignRecord): Promise<void> {
    if (this.activeCampaigns.has(campaign.id)) {
      return;
    }

    this.activeCampaigns.add(campaign.id);
    try {
      if (campaign.status === "queued") {
        const promoted = await this.repository.promoteQueuedCampaign(campaign.id);
        if (!promoted) {
          return;
        }
      }

      const previousContext = await this.repository.getLatestCycleContext(campaign.id);
      const cycleNumber =
        typeof previousContext?.cycle === "number" && Number.isFinite(previousContext.cycle)
          ? previousContext.cycle + 1
          : 1;
      const context: CampaignContext = {
        campaignId: campaign.id,
        targetUrl: campaign.target_url ?? undefined,
        seedTopic: campaign.seed_topic ?? undefined,
        ...(previousContext ?? {}),
        cycle: cycleNumber
      };

      await this.repository.logSafe({
        campaignId: campaign.id,
        agentName: "Shiva",
        state: "cycle_started",
        message: `Starting campaign cycle ${cycleNumber}.`,
        payload: {
          cycle: cycleNumber,
          targetUrl: campaign.target_url,
          seedTopic: campaign.seed_topic
        }
      });

      const executionOrder = this.teamManifest.agents;
      for (let index = 0; index < executionOrder.length; index += 1) {
        const agentId = executionOrder[index];
        const nextAgentId = executionOrder[index + 1];
        if (!agentId) {
          continue;
        }
        const agent = this.agentMap.get(agentId);
        if (!agent) {
          throw new Error(`Agent profile "${agentId}" is not loaded.`);
        }

        const anthropicApiKey = await this.resolveProviderSecret({
          campaign,
          provider: "anthropic",
          requestedByAgent: agent.name,
          reason:
            "Anthropic key is required to execute autonomous planning/output generation for this campaign."
        });

        await this.executeAgent(
          agent,
          nextAgentId,
          campaign.id,
          context,
          anthropicApiKey,
          campaign
        );
      }

      context.last_cycle_completed_at = new Date().toISOString();
      await this.repository.logSafe({
        campaignId: campaign.id,
        agentName: "Shiva",
        state: "cycle_context_snapshot",
        message: `Cycle ${cycleNumber} context snapshot`,
        payload: context
      });
      await this.repository.updateCampaignStatus(campaign.id, "running");
      this.lastCycleAt.set(campaign.id, Date.now());

      await this.repository.logSafe({
        campaignId: campaign.id,
        agentName: "Shiva",
        state: "cycle_completed",
        message: `Completed campaign cycle ${cycleNumber}.`,
        payload: {
          cycle: cycleNumber
        }
      });
    } catch (error) {
      if (error instanceof CredentialPendingError) {
        this.lastCycleAt.set(campaign.id, Date.now());
        await this.repository.updateCampaignStatus(campaign.id, "running");
        await this.repository.logSafe({
          campaignId: campaign.id,
          agentName: "Shiva",
          level: "warn",
          state: "waiting_for_credentials",
          message: error.message,
          payload: {
            provider: error.provider
          }
        });
        return;
      }

      await this.repository.logSafe({
        campaignId: campaign.id,
        agentName: "Shiva",
        level: "error",
        state: "cycle_failed",
        message: error instanceof Error ? error.message : "Campaign cycle failed."
      });
    } finally {
      this.activeCampaigns.delete(campaign.id);
    }
  }

  private async executeAgent(
    agent: AgentProfile,
    nextAgentId: string | undefined,
    campaignId: string,
    context: CampaignContext,
    anthropicApiKey: string,
    campaign: CampaignRecord
  ): Promise<void> {
    const skillRequirement = this.buildSkillRequirement(agent, context);
    const installed = await this.skillTool.execute({
      requirement: skillRequirement,
      agentName: agent.name,
      campaignId
    });

    await this.ensureDiscoveredProviderKeys(
      campaign,
      agent.name,
      installed.requiredProviders ?? [],
      campaignId
    );

    await this.repository.logSafe({
      campaignId,
      agentName: agent.name,
      state: "executing_task",
      message: `Executing ${agent.title} task using ${installed.skill.slug}.`,
      payload: {
        requirement: skillRequirement,
        skill: installed.skill.slug
      },
      skillName: installed.skill.slug
    });

    const output = await this.anthropic.runAgent({
      agent,
      campaignId,
      installedSkill: {
        slug: installed.skill.slug,
        description: installed.skill.description,
        command: installed.command
      },
      context,
      nextAgentId,
      apiKey: anthropicApiKey
    });

    await this.persistDbActions(campaignId, agent, output);

    context[agent.id] = {
      summary: output.summary,
      output: output.context_delta,
      executed_skill: installed.skill.slug,
      completed_at: new Date().toISOString()
    };
    Object.assign(context, output.context_delta);

    await this.repository.logSafe({
      campaignId,
      agentName: agent.name,
      state: "task_completed",
      message: output.summary,
      payload: {
        contextDeltaKeys: Object.keys(output.context_delta),
        nextRequirements: output.next_requirements ?? []
      },
      skillName: installed.skill.slug
    });

    if (nextAgentId) {
      const handoff: AgentHandoff = {
        campaignId,
        cycle: Number(context.cycle) || 1,
        from: agent.id,
        to: nextAgentId,
        timestamp: new Date().toISOString(),
        data: output.handoff_payload
      };

      await this.repository.logSafe({
        campaignId,
        agentName: agent.name,
        state: "json_handoff",
        message: `Handoff from ${agent.id} to ${nextAgentId}.`,
        payload: handoff
      });
    }
  }

  private async resolveProviderSecret(args: {
    campaign: CampaignRecord;
    provider: string;
    requestedByAgent: string;
    reason: string;
  }): Promise<string> {
    if (args.campaign.user_id) {
      const integration = await this.repository.getUserIntegration(args.campaign.user_id, args.provider);
      if (integration?.status === "active") {
        if (!this.config.CREDENTIAL_ENCRYPTION_KEY) {
          throw new Error(
            "CREDENTIAL_ENCRYPTION_KEY is not configured in orchestrator for decrypting user integrations."
          );
        }

        const decrypted = decryptStoredSecret(integration.encryptedSecret, this.config.CREDENTIAL_ENCRYPTION_KEY);
        const extracted = this.extractPrimarySecretValue(args.provider, decrypted);
        if (extracted) {
          return extracted;
        }
      }

      await this.repository.ensureCredentialRequest({
        userId: args.campaign.user_id,
        provider: args.provider,
        requestedByAgent: args.requestedByAgent,
        reason: args.reason,
        metadata: {
          campaignId: args.campaign.id
        }
      });

      await this.repository.logSafe({
        campaignId: args.campaign.id,
        agentName: args.requestedByAgent,
        level: "warn",
        state: "credential_requested",
        message: `Missing ${args.provider} key. Created credential request for user.`,
        payload: {
          provider: args.provider,
          userId: args.campaign.user_id
        }
      });
    }

    if (args.provider === "anthropic" && this.config.ANTHROPIC_API_KEY) {
      return this.config.ANTHROPIC_API_KEY;
    }
    if (args.provider === "telegram_bot" && this.config.TELEGRAM_BOT_TOKEN) {
      return this.config.TELEGRAM_BOT_TOKEN;
    }

    throw new CredentialPendingError(
      args.provider,
      `No ${args.provider} key available for campaign ${args.campaign.id}.`
    );
  }

  private extractPrimarySecretValue(provider: string, rawDecrypted: string): string | null {
    const keyByProvider: Record<string, string[]> = {
      anthropic: ["api_key", "key", "token"],
      telegram_bot: ["bot_token", "token"],
      wordpress: ["app_password", "password"],
      webflow: ["api_token", "token"],
      gsc: ["service_account_json", "json"],
      custom: ["secret_json", "api_key", "token", "secret"]
    };

    const preferredKeys = keyByProvider[provider] ?? ["api_key", "token", "secret"];

    try {
      const parsed = JSON.parse(rawDecrypted) as Record<string, unknown>;
      for (const key of preferredKeys) {
        const value = parsed[key];
        if (typeof value === "string" && value.trim().length > 0) {
          return value.trim();
        }
      }

      const firstString = Object.values(parsed).find(
        (entry): entry is string => typeof entry === "string" && entry.trim().length > 0
      );
      return firstString?.trim() ?? null;
    } catch {
      return rawDecrypted.trim().length > 0 ? rawDecrypted.trim() : null;
    }
  }

  private async ensureDiscoveredProviderKeys(
    campaign: CampaignRecord,
    agentName: string,
    requiredProviders: string[],
    campaignId: string
  ): Promise<void> {
    const providers = [...new Set(requiredProviders.filter((provider) => provider !== "anthropic"))];
    for (const provider of providers) {
      try {
        await this.resolveProviderSecret({
          campaign,
          provider,
          requestedByAgent: agentName,
          reason: `The discovered skill requires ${provider} credentials before execution can continue.`
        });
      } catch (error) {
        if (error instanceof CredentialPendingError) {
          await this.repository.logSafe({
            campaignId,
            agentName,
            level: "warn",
            state: "provider_key_missing",
            message: error.message,
            payload: {
              provider
            }
          });
        }
        throw error;
      }
    }
  }

  private buildSkillRequirement(agent: AgentProfile, context: CampaignContext): string {
    const target = (context.targetUrl as string | undefined) ?? (context.seedTopic as string | undefined) ?? "campaign";
    const capabilities = agent.skill_policy.target_capabilities;
    const capabilityIndex = Math.max(0, (Number(context.cycle) || 1) - 1) % capabilities.length;
    const capability = capabilities[capabilityIndex] ?? capabilities[0] ?? "general capability";

    return [
      `Agent role: ${agent.title}`,
      `Campaign target: ${target}`,
      `Need capability: ${capability}`,
      "Install the best matching skill and prepare to execute immediately."
    ].join(" | ");
  }

  private async persistDbActions(
    campaignId: string,
    agent: AgentProfile,
    output: AgentExecutionOutput
  ): Promise<void> {
    if (output.db_actions.keywords && output.db_actions.keywords.length > 0) {
      const validKeywords = output.db_actions.keywords.filter(
        (entry): entry is { keyword: string; intent?: string; difficulty?: number; rankPosition?: number } =>
          Boolean(entry && typeof entry.keyword === "string" && entry.keyword.trim().length > 0)
      );
      await this.repository.insertKeywordRecords({
        campaignId,
        sourceAgent: agent.name,
        keywords: validKeywords
      });
    }

    if (output.db_actions.content) {
      const content = output.db_actions.content;
      if (content.title && content.slug && content.html) {
        await this.repository.insertContentRecord({
          campaignId,
          title: content.title,
          slug: content.slug,
          html: content.html,
          cmsTarget: content.cmsTarget,
          featuredImageUrl: content.featuredImageUrl,
          publishStatus: content.publishStatus,
          publishedUrl: content.publishedUrl,
          metadata: content.metadata
        });
      }
    }

    if (output.db_actions.outreach && output.db_actions.outreach.length > 0) {
      const validOutreach = output.db_actions.outreach.filter(
        (entry): entry is {
          prospectDomain: string;
          contactName?: string;
          contactEmail?: string;
          pitchSubject?: string;
          pitchBody?: string;
          outreachStatus?: "queued" | "sent" | "replied" | "won" | "lost";
          responseStatus?: string;
          metadata?: Record<string, unknown>;
        } => Boolean(entry && typeof entry.prospectDomain === "string" && entry.prospectDomain.trim().length > 0)
      );

      await this.repository.insertOutreachRecords({
        campaignId,
        records: validOutreach
      });
    }
  }
}
