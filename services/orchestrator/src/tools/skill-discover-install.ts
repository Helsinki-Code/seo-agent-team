import type { Repository } from "../repository.js";
import type { InstalledSkill, SkillCandidate } from "../types.js";
import { SkillsRegistryClient } from "./skills-registry.js";

type ExecuteInput = {
  requirement: string;
  agentName: string;
  campaignId?: string;
};

type TokenScore = {
  skill: SkillCandidate;
  score: number;
};

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length > 1);
}

function rankSkills(requirement: string, candidates: SkillCandidate[]): SkillCandidate[] {
  const requirementTokens = new Set(tokenize(requirement));
  const scored: TokenScore[] = candidates.map((skill) => {
    const nameTokens = tokenize(skill.name);
    const descriptionTokens = tokenize(skill.description);
    let score = 0;

    for (const token of nameTokens) {
      if (requirementTokens.has(token)) {
        score += 3;
      }
    }

    for (const token of descriptionTokens) {
      if (requirementTokens.has(token)) {
        score += 1;
      }
    }

    if (skill.installCommand) {
      score += 1;
    }

    return { skill, score };
  });

  return scored.sort((a, b) => b.score - a.score).map((item) => item.skill);
}

export class SkillDiscoverAndInstallTool {
  constructor(
    private readonly registry: SkillsRegistryClient,
    private readonly repository: Repository
  ) {}

  async execute(input: ExecuteInput): Promise<InstalledSkill> {
    await this.repository.logSafe({
      campaignId: input.campaignId,
      agentName: input.agentName,
      state: "searching_for_skill",
      message: `Searching skills registry for requirement: ${input.requirement}`,
      payload: { requirement: input.requirement }
    });

    const candidates = await this.registry.search(input.requirement);
    const rankedCandidates = rankSkills(input.requirement, candidates);

    if (rankedCandidates.length === 0) {
      throw new Error("No relevant skills were found.");
    }

    const installErrors: string[] = [];

    for (const skill of rankedCandidates.slice(0, 5)) {
      await this.repository.logSafe({
        campaignId: input.campaignId,
        agentName: input.agentName,
        state: "installing_skill",
        message: `Installing skill candidate: ${skill.name}`,
        payload: {
          requirement: input.requirement,
          slug: skill.slug,
          description: skill.description
        },
        skillName: skill.slug
      });

      try {
        const installed = await this.registry.install(skill);

        await this.repository.logSafe({
          campaignId: input.campaignId,
          agentName: input.agentName,
          state: "skill_installed",
          message: `Installed skill ${skill.name}`,
          payload: {
            command: installed.command,
            requiredProviders: installed.requiredProviders ?? []
          },
          skillName: skill.slug
        });

        return installed;
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Unknown installation error";
        installErrors.push(`${skill.slug}: ${reason}`);
        await this.repository.logSafe({
          campaignId: input.campaignId,
          agentName: input.agentName,
          level: "warn",
          state: "skill_install_failed",
          message: `Failed to install ${skill.slug}: ${reason}`,
          skillName: skill.slug
        });
      }
    }

    throw new Error(`Unable to install a skill for requirement "${input.requirement}". ${installErrors.join(" | ")}`);
  }
}
