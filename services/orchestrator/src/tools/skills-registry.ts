import type { RuntimeConfig } from "../config.js";
import type { InstalledSkill, SkillCandidate } from "../types.js";
import { runCommand, splitShellWords } from "./command-runner.js";

function stripAnsi(input: string): string {
  return input.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, "");
}

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:@/._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildSkillFromUnknown(item: unknown): SkillCandidate | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const candidate = item as Record<string, unknown>;
  const name = String(candidate.name ?? candidate.title ?? candidate.slug ?? "").trim();
  const description = String(candidate.description ?? candidate.summary ?? "").trim();
  const slug = String(candidate.slug ?? name).trim();

  if (!name || !description || !slug) {
    return null;
  }

  const installCommand =
    typeof candidate.install_command === "string"
      ? candidate.install_command
      : typeof candidate.installCommand === "string"
        ? candidate.installCommand
        : undefined;

  return {
    name,
    slug: normalizeSlug(slug),
    description,
    installCommand,
    source: "json",
    raw: candidate
  };
}

function parseCandidatesFromJson(output: string): SkillCandidate[] {
  const parsed = JSON.parse(output);
  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { skills?: unknown[] }).skills)
      ? (parsed as { skills: unknown[] }).skills
      : [];

  return list.map(buildSkillFromUnknown).filter((item): item is SkillCandidate => item !== null);
}

function parseCandidatesFromText(output: string): SkillCandidate[] {
  const normalized = stripAnsi(output);

  const lines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const parsed: SkillCandidate[] = [];

  for (const line of lines) {
    const numbered = line.match(/^\d+\.\s+(.+?)\s+-\s+(.+)$/);
    const plain = line.match(/^([a-z0-9:._@/-]+)\s+-\s+(.+)$/i);
    const registryEntry = line.match(/^([a-z0-9._-]+\/[a-z0-9._-]+@[a-z0-9._-]+)\s+(.+)$/i);
    const registryUrl = line.match(/https:\/\/skills\.sh\/([^/\s]+)\/([^/\s]+)\/([^/\s]+)/i);
    const heading = line.match(/^#{1,6}\s+(.+)$/);

    if (numbered) {
      const name = numbered[1];
      const description = numbered[2];
      if (!name || !description) {
        continue;
      }
      parsed.push({
        name,
        slug: normalizeSlug(name),
        description,
        source: "text",
        raw: line
      });
      continue;
    }

    if (plain) {
      const name = plain[1];
      const description = plain[2];
      if (!name || !description) {
        continue;
      }
      parsed.push({
        name,
        slug: normalizeSlug(name),
        description,
        source: "text",
        raw: line
      });
      continue;
    }

    if (registryEntry) {
      const slug = registryEntry[1];
      const description = registryEntry[2];
      if (!slug || !description) {
        continue;
      }
      parsed.push({
        name: slug,
        slug: normalizeSlug(slug),
        description,
        source: "text",
        raw: line
      });
      continue;
    }

    if (registryUrl) {
      const owner = registryUrl[1];
      const repo = registryUrl[2];
      const skill = registryUrl[3];
      if (!owner || !repo || !skill) {
        continue;
      }
      const slug = `${owner}/${repo}@${skill}`;
      parsed.push({
        name: slug,
        slug: normalizeSlug(slug),
        description: `Registry URL: ${line}`,
        source: "text",
        raw: line
      });
      continue;
    }

    if (heading) {
      const name = heading[1];
      if (!name) {
        continue;
      }
      parsed.push({
        name,
        slug: normalizeSlug(name),
        description: "Discovered from registry text output.",
        source: "text",
        raw: line
      });
    }
  }

  const deduped = new Map<string, SkillCandidate>();
  for (const candidate of parsed) {
    deduped.set(candidate.slug, candidate);
  }

  return [...deduped.values()];
}

export class SkillsRegistryClient {
  private readonly searchArgs: string[];
  private readonly installArgs: string[];

  constructor(private readonly config: RuntimeConfig) {
    this.searchArgs = splitShellWords(config.SKILLS_SEARCH_SUBCOMMAND);
    this.installArgs = splitShellWords(config.SKILLS_INSTALL_SUBCOMMAND);
  }

  async search(requirement: string): Promise<SkillCandidate[]> {
    const initial = await runCommand({
      command: this.config.SKILLS_CLI_BIN,
      commandArgs: [...this.searchArgs, requirement, "--json"],
      timeoutMs: this.config.SKILLS_COMMAND_TIMEOUT_MS
    });

    if (initial.exitCode === 0 && initial.stdout) {
      try {
        const candidates = parseCandidatesFromJson(initial.stdout);
        if (candidates.length > 0) {
          return candidates;
        }
      } catch {
        // Fallback to text parse below.
      }
    }

    const fallback = await runCommand({
      command: this.config.SKILLS_CLI_BIN,
      commandArgs: [...this.searchArgs, requirement],
      timeoutMs: this.config.SKILLS_COMMAND_TIMEOUT_MS
    });

    if (fallback.exitCode !== 0) {
      throw new Error(
        `skills registry search failed: ${fallback.stderr || fallback.stdout || "unknown failure"}`
      );
    }

    const textCandidates = parseCandidatesFromText(fallback.stdout);
    if (textCandidates.length === 0) {
      throw new Error("skills registry search returned no parseable skills.");
    }

    return textCandidates;
  }

  async install(skill: SkillCandidate): Promise<InstalledSkill> {
    const installParts = skill.installCommand
      ? splitShellWords(skill.installCommand)
      : [this.config.SKILLS_CLI_BIN, ...this.installArgs, skill.slug];

    const [command, ...commandArgs] = this.ensureNonInteractiveInstall(installParts);
    if (!command) {
      throw new Error(`Unable to resolve install command for skill ${skill.name}.`);
    }

    const result = await runCommand({
      command,
      commandArgs,
      timeoutMs: this.config.SKILLS_COMMAND_TIMEOUT_MS
    });

    if (result.exitCode !== 0) {
      throw new Error(result.stderr || result.stdout || `Failed to install ${skill.name}`);
    }

    return {
      skill,
      command: [command, ...commandArgs].join(" "),
      stdout: result.stdout,
      stderr: result.stderr
    };
  }

  private ensureNonInteractiveInstall(commandParts: string[]): string[] {
    const parts = [...commandParts];
    const joined = parts.join(" ").toLowerCase();
    const isSkillsAdd = /\bskills\b/.test(joined) && /\badd\b/.test(joined);

    if (!isSkillsAdd) {
      return parts;
    }

    if (!parts.includes("--yes") && !parts.includes("-y")) {
      parts.push("--yes");
    }

    if (!parts.includes("--global") && !parts.includes("-g")) {
      parts.push("--global");
    }

    return parts;
  }
}
