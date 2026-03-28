import { readConfig } from "./config.js";
import { AgentRegistry } from "./openclaw/agent-registry.js";
import { AnthropicClient } from "./openclaw/anthropic-client.js";
import { CampaignAutopilot } from "./openclaw/campaign-autopilot.js";
import { OpenClawDaemonManager } from "./openclaw/daemon-manager.js";
import { Repository } from "./repository.js";
import { buildServer } from "./server.js";
import { TelegramService } from "./telegram/telegram-service.js";
import { SkillDiscoverAndInstallTool } from "./tools/skill-discover-install.js";
import { SkillsRegistryClient } from "./tools/skills-registry.js";

async function main() {
  const config = readConfig();
  const repository = new Repository(config);
  const registry = new AgentRegistry("services/orchestrator/openclaw");
  const [agentProfiles, teamManifest] = await Promise.all([
    registry.loadAgents(),
    registry.loadTeamManifest()
  ]);

  const openclaw = new OpenClawDaemonManager(config, repository);
  try {
    await openclaw.start();
  } catch (error) {
    await repository.logSafe({
      agentName: "OpenClaw",
      level: "warn",
      state: "daemon_start_failed",
      message:
        error instanceof Error
          ? `OpenClaw daemon failed to start, internal autopilot remains active: ${error.message}`
          : "OpenClaw daemon failed to start, internal autopilot remains active."
    });
  }

  const skillsRegistry = new SkillsRegistryClient(config);
  const skillTool = new SkillDiscoverAndInstallTool(skillsRegistry, repository);
  const anthropic = new AnthropicClient(config);
  const autopilot = new CampaignAutopilot(
    config,
    repository,
    skillTool,
    anthropic,
    agentProfiles,
    teamManifest
  );
  const telegram = new TelegramService(config, repository, openclaw);

  if (telegram.enabled && config.ORCHESTRATOR_PUBLIC_URL) {
    await telegram.configureWebhook();
    await repository.logSafe({
      agentName: "Shiva",
      state: "telegram_webhook_ready",
      message: `Telegram webhook configured at ${config.ORCHESTRATOR_PUBLIC_URL}/telegram/webhook`
    });
  }

  const app = await buildServer({
    config,
    repository,
    openclaw,
    skillTool,
    telegram,
    agentProfiles,
    teamManifest,
    autopilot
  });

  await app.listen({ host: "0.0.0.0", port: config.PORT });
  autopilot.start();
  await repository.logSafe({
    agentName: "Shiva",
    state: "orchestrator_online",
    message: `Orchestrator listening on port ${config.PORT}`
  });
  await repository.logSafe({
    agentName: "Shiva",
    state: "phase2_agent_profiles_loaded",
    message: `Loaded ${agentProfiles.length} agent profiles with entry agent ${teamManifest.entry_agent}.`,
    payload: {
      teamName: teamManifest.team_name,
      agents: agentProfiles.map((agent) => agent.id)
    }
  });

  const shutdown = async () => {
    await repository.logSafe({
      agentName: "Shiva",
      state: "shutdown_started",
      message: "Shutting down orchestrator."
    });
    await app.close();
    autopilot.stop();
    await openclaw.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
