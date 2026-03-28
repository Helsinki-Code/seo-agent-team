import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import type { RuntimeConfig } from "./config.js";
import type { AgentProfile, TeamManifest } from "./openclaw/agent-registry.js";
import type { CampaignAutopilot } from "./openclaw/campaign-autopilot.js";
import type { OpenClawDaemonManager } from "./openclaw/daemon-manager.js";
import type { Repository } from "./repository.js";
import type { SkillDiscoverAndInstallTool } from "./tools/skill-discover-install.js";
import type { TelegramService } from "./telegram/telegram-service.js";

type ServerDeps = {
  config: RuntimeConfig;
  repository: Repository;
  openclaw: OpenClawDaemonManager;
  skillTool: SkillDiscoverAndInstallTool;
  telegram: TelegramService;
  agentProfiles: AgentProfile[];
  teamManifest: TeamManifest;
  autopilot: CampaignAutopilot;
};

const createCampaignSchema = z
  .object({
    targetUrl: z.string().url().optional(),
    seedTopic: z.string().min(2).optional(),
    userId: z.string().min(2).optional()
  })
  .refine((payload) => Boolean(payload.targetUrl || payload.seedTopic), {
    message: "Provide targetUrl or seedTopic."
  });

const skillInstallSchema = z.object({
  requirement: z.string().min(3),
  agentName: z.string().min(2),
  campaignId: z.string().uuid().optional()
});

export async function buildServer(deps: ServerDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: deps.config.WEB_ORIGIN,
    credentials: true
  });

  app.get("/health", async () => {
    return {
      status: "ok",
      daemonRunning: deps.openclaw.isRunning,
      agentsLoaded: deps.agentProfiles.length,
      autopilot: deps.autopilot.getStatus()
    };
  });

  app.get("/agents", async () => {
    return {
      team: deps.teamManifest.team_name,
      entryAgent: deps.teamManifest.entry_agent,
      agents: deps.agentProfiles
    };
  });

  app.post("/campaigns", async (request, reply) => {
    const parsed = createCampaignSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const campaign = await deps.repository.createCampaign({
      initiatedBy: "web",
      targetUrl: parsed.data.targetUrl,
      seedTopic: parsed.data.seedTopic,
      userId: parsed.data.userId
    });

    await deps.repository.logSafe({
      campaignId: campaign.id,
      agentName: "Shiva",
      state: "campaign_created",
      message: `Campaign created from web input: ${campaign.target_url ?? campaign.seed_topic}`
    });

    try {
      await deps.openclaw.dispatchCampaign({
        campaignId: campaign.id,
        targetUrl: campaign.target_url,
        seedTopic: campaign.seed_topic
      });
    } catch (error) {
      await deps.repository.logSafe({
        campaignId: campaign.id,
        agentName: "Shiva",
        level: "warn",
        state: "dispatch_skipped",
        message:
          error instanceof Error
            ? `OpenClaw dispatch failed, internal autopilot will continue: ${error.message}`
            : "OpenClaw dispatch failed, internal autopilot will continue."
      });
    }

    return reply.code(201).send({ campaignId: campaign.id });
  });

  app.post("/campaigns/:campaignId/trigger", async (request, reply) => {
    const paramsSchema = z.object({ campaignId: z.string().uuid() });
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ error: params.error.flatten() });
    }

    await deps.autopilot.triggerCampaignNow(params.data.campaignId);
    return reply.code(202).send({ triggered: true, campaignId: params.data.campaignId });
  });

  app.post("/tools/skill-discover-install", async (request, reply) => {
    const parsed = skillInstallSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const installed = await deps.skillTool.execute(parsed.data);
    return {
      installedSkill: installed.skill.slug,
      command: installed.command,
      stdout: installed.stdout
    };
  });

  app.post("/telegram/webhook", async (request, reply) => {
    if (!deps.telegram.enabled) {
      return reply.code(503).send({ error: "Telegram integration is not configured." });
    }

    const secretToken = request.headers["x-telegram-bot-api-secret-token"];
    const secret = Array.isArray(secretToken) ? secretToken[0] : secretToken;
    if (!deps.telegram.validateSecret(secret)) {
      return reply.code(401).send({ error: "Invalid Telegram secret token." });
    }

    await deps.telegram.handleWebhook(request.body);
    return reply.code(200).send({ ok: true });
  });

  app.get("/autopilot/status", async () => {
    return deps.autopilot.getStatus();
  });

  return app;
}
