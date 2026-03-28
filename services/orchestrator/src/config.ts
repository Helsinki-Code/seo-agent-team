import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  CREDENTIAL_ENCRYPTION_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-3-7-sonnet-latest"),
  ANTHROPIC_MAX_TOKENS: z.coerce.number().int().positive().default(2500),
  ANTHROPIC_API_BASE_URL: z.string().url().default("https://api.anthropic.com"),
  OPENCLAW_DAEMON_COMMAND: z
    .string()
    .default("openclaw daemon --config services/orchestrator/openclaw.config.json"),
  OPENCLAW_DISPATCH_COMMAND: z
    .string()
    .default("openclaw dispatch --config services/orchestrator/openclaw.config.json"),
  OPENCLAW_RUNTIME_DIR: z.string().default("openclaw-runtime"),
  SKILLS_CLI_BIN: z.string().default("npx"),
  SKILLS_SEARCH_SUBCOMMAND: z.string().default("skills find"),
  SKILLS_INSTALL_SUBCOMMAND: z.string().default("skills add --yes --global"),
  SKILLS_COMMAND_TIMEOUT_MS: z.coerce.number().int().positive().default(120000),
  AUTOPILOT_POLL_MS: z.coerce.number().int().positive().default(15000),
  AUTOPILOT_CYCLE_INTERVAL_MS: z.coerce.number().int().positive().default(1800000),
  AUTOPILOT_BATCH_SIZE: z.coerce.number().int().positive().max(25).default(3),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
  ORCHESTRATOR_PUBLIC_URL: z.string().url().optional()
});

export type RuntimeConfig = z.infer<typeof envSchema>;

export function readConfig(): RuntimeConfig {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
  }

  return parsed.data;
}
