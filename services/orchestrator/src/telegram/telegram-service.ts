import type { RuntimeConfig } from "../config.js";
import type { OpenClawDaemonManager } from "../openclaw/daemon-manager.js";
import type { Repository } from "../repository.js";

type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number };
    text?: string;
  };
};

function asTelegramUpdate(value: unknown): TelegramUpdate {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid Telegram payload.");
  }

  return value as TelegramUpdate;
}

export class TelegramService {
  constructor(
    private readonly config: RuntimeConfig,
    private readonly repository: Repository,
    private readonly openclaw: OpenClawDaemonManager
  ) {}

  get enabled(): boolean {
    return Boolean(this.config.TELEGRAM_BOT_TOKEN);
  }

  validateSecret(secretHeader?: string): boolean {
    if (!this.config.TELEGRAM_WEBHOOK_SECRET) {
      return true;
    }

    return secretHeader === this.config.TELEGRAM_WEBHOOK_SECRET;
  }

  async configureWebhook(): Promise<void> {
    if (!this.enabled || !this.config.ORCHESTRATOR_PUBLIC_URL) {
      return;
    }

    const endpoint = `${this.config.ORCHESTRATOR_PUBLIC_URL}/telegram/webhook`;
    const payload = {
      url: endpoint,
      secret_token: this.config.TELEGRAM_WEBHOOK_SECRET
    };

    const result = await this.callTelegramApi("setWebhook", payload);
    if (!result.ok) {
      throw new Error(`Failed to set Telegram webhook: ${JSON.stringify(result)}`);
    }
  }

  async handleWebhook(payload: unknown): Promise<void> {
    const update = asTelegramUpdate(payload);
    const text = update.message?.text?.trim();
    const chatId = update.message?.chat.id;

    if (!text || !chatId) {
      return;
    }

    const match = text.match(/^start\s+seo\s+campaign\s+for\s+(.+)$/i);

    if (!match) {
      await this.sendMessage(
        chatId,
        "Message format: Start SEO campaign for <URL or seed topic>"
      );
      return;
    }

    const rawTarget = match[1]?.trim();
    if (!rawTarget) {
      await this.sendMessage(chatId, "Please provide a URL or topic after 'Start SEO campaign for'.");
      return;
    }

    const isUrl = /^https?:\/\//i.test(rawTarget);
    const campaign = await this.repository.createCampaign({
      initiatedBy: "telegram",
      targetUrl: isUrl ? rawTarget : undefined,
      seedTopic: isUrl ? undefined : rawTarget
    });

    await this.repository.logSafe({
      campaignId: campaign.id,
      agentName: "Shiva",
      state: "campaign_created",
      message: `Campaign created from Telegram: ${rawTarget}`
    });

    try {
      await this.openclaw.dispatchCampaign({
        campaignId: campaign.id,
        targetUrl: campaign.target_url,
        seedTopic: campaign.seed_topic
      });
    } catch (error) {
      await this.repository.logSafe({
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

    await this.sendMessage(
      chatId,
      `Campaign ${campaign.id} started.\nTarget: ${campaign.target_url ?? campaign.seed_topic}`
    );
  }

  private async sendMessage(chatId: number, text: string): Promise<void> {
    await this.callTelegramApi("sendMessage", {
      chat_id: chatId,
      text
    });
  }

  private async callTelegramApi(method: string, body: Record<string, unknown>) {
    if (!this.config.TELEGRAM_BOT_TOKEN) {
      throw new Error("Telegram bot token not configured.");
    }

    const response = await fetch(
      `https://api.telegram.org/bot${this.config.TELEGRAM_BOT_TOKEN}/${method}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      }
    );

    return (await response.json()) as { ok: boolean; [key: string]: unknown };
  }
}
