export type IntegrationField = {
  key: string;
  label: string;
  type: "text" | "password" | "textarea" | "url";
  required: boolean;
  secret: boolean;
  placeholder?: string;
  helper?: string;
};

export type IntegrationProviderConfig = {
  id: string;
  label: string;
  shortDescription: string;
  docsUrl: string;
  setupSteps: string[];
  fields: IntegrationField[];
};

export const INTEGRATION_CATALOG: IntegrationProviderConfig[] = [
  {
    id: "anthropic",
    label: "Anthropic",
    shortDescription: "LLM runtime for campaign reasoning and JSON task output.",
    docsUrl: "https://console.anthropic.com/settings/keys",
    setupSteps: [
      "Open Anthropic Console and create an API key.",
      "Copy the key and paste it into API Key.",
      "Optionally set a preferred model slug for this workspace."
    ],
    fields: [
      {
        key: "api_key",
        label: "API Key",
        type: "password",
        required: true,
        secret: true,
        placeholder: "sk-ant-api03-...",
        helper: "Used by the orchestrator for per-user model calls."
      },
      {
        key: "model",
        label: "Preferred Model (optional)",
        type: "text",
        required: false,
        secret: false,
        placeholder: "claude-3-7-sonnet-latest"
      }
    ]
  },
  {
    id: "telegram_bot",
    label: "Telegram Bot",
    shortDescription: "User intake channel and notifications via bot commands.",
    docsUrl: "https://core.telegram.org/bots#6-botfather",
    setupSteps: [
      "Message @BotFather and run /newbot to create your bot.",
      "Copy the Bot Token and paste it here.",
      "Generate a webhook secret token and paste it.",
      "Optional: set a default chat ID for proactive status notifications."
    ],
    fields: [
      {
        key: "bot_token",
        label: "Bot Token",
        type: "password",
        required: true,
        secret: true,
        placeholder: "123456789:AA..."
      },
      {
        key: "webhook_secret",
        label: "Webhook Secret",
        type: "password",
        required: true,
        secret: true,
        placeholder: "long-random-secret"
      },
      {
        key: "default_chat_id",
        label: "Default Chat ID (optional)",
        type: "text",
        required: false,
        secret: false,
        placeholder: "-1001234567890"
      }
    ]
  },
  {
    id: "wordpress",
    label: "WordPress",
    shortDescription: "Direct publishing target for generated HTML content.",
    docsUrl: "https://wordpress.com/support/security/two-step-authentication/application-specific-passwords/",
    setupSteps: [
      "Open your WordPress profile and create an Application Password.",
      "Copy site URL, username, and generated app password.",
      "Use HTTPS site URL and verify /wp-json endpoint is reachable."
    ],
    fields: [
      {
        key: "site_url",
        label: "Site URL",
        type: "url",
        required: true,
        secret: false,
        placeholder: "https://your-site.com"
      },
      {
        key: "username",
        label: "Username",
        type: "text",
        required: true,
        secret: false
      },
      {
        key: "app_password",
        label: "Application Password",
        type: "password",
        required: true,
        secret: true
      }
    ]
  },
  {
    id: "webflow",
    label: "Webflow",
    shortDescription: "CMS publishing target for Webflow-powered properties.",
    docsUrl: "https://developers.webflow.com/data/docs",
    setupSteps: [
      "Create a Data API token in Webflow workspace settings.",
      "Copy your Site ID from Webflow project settings.",
      "Paste both values and validate connection."
    ],
    fields: [
      {
        key: "api_token",
        label: "API Token",
        type: "password",
        required: true,
        secret: true
      },
      {
        key: "site_id",
        label: "Site ID",
        type: "text",
        required: true,
        secret: false
      }
    ]
  },
  {
    id: "gsc",
    label: "Google Search Console",
    shortDescription: "Rank and indexing telemetry for post-publish monitoring.",
    docsUrl: "https://developers.google.com/search/apis/indexing-api/v3/prereqs",
    setupSteps: [
      "Create a Google Cloud service account with Search Console access.",
      "Download the JSON key and paste it below.",
      "Set the exact property URL as configured in Search Console."
    ],
    fields: [
      {
        key: "service_account_json",
        label: "Service Account JSON",
        type: "textarea",
        required: true,
        secret: true,
        helper: "Paste the full JSON content."
      },
      {
        key: "property_url",
        label: "Property URL",
        type: "url",
        required: true,
        secret: false,
        placeholder: "https://example.com/"
      }
    ]
  },
  {
    id: "email_provider",
    label: "Email Provider",
    shortDescription: "Used by outreach agents to send personalized pitch emails.",
    docsUrl: "https://resend.com/docs/send-with-api",
    setupSteps: [
      "Pick your sending provider (Resend, Mailgun, SMTP, etc.).",
      "Create an API key or SMTP credential.",
      "Store sender identity/domain in settings."
    ],
    fields: [
      {
        key: "api_key",
        label: "API Key / SMTP Password",
        type: "password",
        required: true,
        secret: true
      },
      {
        key: "provider_name",
        label: "Provider Name",
        type: "text",
        required: true,
        secret: false,
        placeholder: "resend"
      },
      {
        key: "from_email",
        label: "From Email",
        type: "text",
        required: true,
        secret: false,
        placeholder: "outreach@yourdomain.com"
      }
    ]
  },
  {
    id: "bfl_flux",
    label: "Black Forest Labs Flux",
    shortDescription: "Image generation provider for context-aware blog media.",
    docsUrl: "https://docs.bfl.ai",
    setupSteps: [
      "Create a BFL account and generate API credentials.",
      "Copy API key and endpoint details.",
      "Save here so Vishnu can generate campaign imagery."
    ],
    fields: [
      {
        key: "api_key",
        label: "API Key",
        type: "password",
        required: true,
        secret: true
      },
      {
        key: "endpoint",
        label: "Endpoint URL (optional)",
        type: "url",
        required: false,
        secret: false,
        placeholder: "https://api.bfl.ai/v1"
      }
    ]
  },
  {
    id: "custom",
    label: "Custom Provider",
    shortDescription: "Store credentials for any discovered provider/skill.",
    docsUrl: "https://skills.sh",
    setupSteps: [
      "Enter provider label details so agents can map this key later.",
      "Paste secret(s) in JSON format for advanced integrations."
    ],
    fields: [
      {
        key: "display_name",
        label: "Provider Name",
        type: "text",
        required: true,
        secret: false,
        placeholder: "bfl_flux"
      },
      {
        key: "secret_json",
        label: "Secret JSON",
        type: "textarea",
        required: true,
        secret: true,
        helper: "Example: {\"api_key\":\"...\"}"
      }
    ]
  }
];

export function getProviderConfig(providerId: string): IntegrationProviderConfig | undefined {
  return INTEGRATION_CATALOG.find((item) => item.id === providerId);
}
