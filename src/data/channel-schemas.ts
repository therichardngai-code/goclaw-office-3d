// Per-channel credential field definitions — ported from goclaw ui/web channel-schemas.ts

export interface CredField {
  key: string;
  label: string;
  type: "text" | "password";
  required?: boolean;
  placeholder?: string;
  help?: string;
}

export const CHANNEL_TYPES = [
  { value: "telegram",      label: "Telegram" },
  { value: "discord",       label: "Discord" },
  { value: "slack",         label: "Slack" },
  { value: "feishu",        label: "Feishu / Lark" },
  { value: "zalo_oa",       label: "Zalo OA" },
  { value: "zalo_personal", label: "Zalo Personal" },
  { value: "whatsapp",      label: "WhatsApp" },
] as const;

export type ChannelTypeValue = typeof CHANNEL_TYPES[number]["value"];

// Credential fields required when creating a channel instance.
// Password fields use type="password" with show/hide toggle in the form.
export const CHANNEL_CREDS: Record<string, CredField[]> = {
  telegram: [
    { key: "token",  label: "Bot Token",   type: "password", required: true,  placeholder: "123456:ABC-DEF…", help: "From @BotFather" },
    { key: "proxy",  label: "HTTP Proxy",  type: "text",     required: false, placeholder: "http://proxy:8080" },
  ],
  discord: [
    { key: "token",  label: "Bot Token",   type: "password", required: true,  placeholder: "Discord bot token" },
  ],
  slack: [
    { key: "bot_token", label: "Bot Token",       type: "password", required: true,  placeholder: "xoxb-…", help: "Bot User OAuth Token" },
    { key: "app_token", label: "App-Level Token", type: "password", required: true,  placeholder: "xapp-…", help: "Required for Socket Mode (connections:write scope)" },
  ],
  feishu: [
    { key: "app_id",     label: "App ID",     type: "text",     required: true,  placeholder: "cli_xxxxx" },
    { key: "app_secret", label: "App Secret", type: "password", required: true },
  ],
  zalo_oa: [
    { key: "token",          label: "OA Access Token", type: "password", required: true },
    { key: "webhook_secret", label: "Webhook Secret",  type: "password", required: false },
  ],
  zalo_personal: [], // auth via QR — no credentials at create time
  whatsapp: [
    { key: "bridge_url", label: "Bridge URL", type: "text", required: true, placeholder: "http://bridge:3000" },
  ],
};
