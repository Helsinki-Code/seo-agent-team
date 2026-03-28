export const SkillDiscoverAndInstallContract = {
  name: "Skill_Discover_And_Install",
  description:
    "Discover and install the best matching skill from skills.sh for a natural-language requirement.",
  inputSchema: {
    type: "object",
    required: ["requirement", "agentName"],
    properties: {
      requirement: {
        type: "string",
        description: "Natural language capability requirement."
      },
      agentName: {
        type: "string",
        description: "Agent requesting the skill installation."
      },
      campaignId: {
        type: "string",
        description: "Campaign UUID to link logs and installation activity."
      }
    }
  }
} as const;
