// Per-channel credential + config field definitions — ported from goclaw ui/web channel-schemas.ts

// ── Credential fields (secrets entered at create time) ───────────────────────

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
    { key: "encrypt_key",         label: "Encrypt Key",         type: "password", help: "For webhook mode" },
    { key: "verification_token",  label: "Verification Token",  type: "password", help: "For webhook mode" },
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

// ── Config fields (approval rules, behaviour settings) ───────────────────────

export interface ConfigField {
  key: string;
  label: string;
  type: "select" | "boolean" | "number" | "tags";
  options?: { value: string; label: string }[];
  defaultValue?: string | number | boolean | string[];
  help?: string;
}

// Shared option lists — mirror goclaw ui/web channel-schemas.ts
const dmPolicyOptions = [
  { value: "pairing",   label: "Pairing (require code)" },
  { value: "open",      label: "Open (accept all)" },
  { value: "allowlist", label: "Allowlist only" },
  { value: "disabled",  label: "Disabled" },
];

const groupPolicyOptions = [
  { value: "open",      label: "Open (accept all)" },
  { value: "pairing",   label: "Pairing (require approval)" },
  { value: "allowlist", label: "Allowlist only" },
  { value: "disabled",  label: "Disabled" },
];

const blockReplyOptions = [
  { value: "inherit", label: "Inherit from gateway" },
  { value: "true",    label: "Enabled" },
  { value: "false",   label: "Disabled" },
];

// Config schema per channel — sent as POST /v1/channels/instances body.config
export const CHANNEL_CONFIG: Record<string, ConfigField[]> = {
  telegram: [
    { key: "dm_policy",       label: "DM Policy",                  type: "select",  options: dmPolicyOptions,    defaultValue: "pairing", help: "How to handle direct messages from unknown users" },
    { key: "group_policy",    label: "Group Policy",               type: "select",  options: groupPolicyOptions, defaultValue: "pairing" },
    { key: "require_mention", label: "Require @mention in groups", type: "boolean", defaultValue: true },
    { key: "allow_from",      label: "Allowed Users",              type: "tags",    help: "Telegram user IDs or @usernames, one per line. Required when policy = allowlist." },
    { key: "history_limit",   label: "Group History Limit",        type: "number",  defaultValue: 50, help: "Max pending group messages for context (0 = disabled)" },
    { key: "dm_stream",       label: "DM Streaming",               type: "boolean", defaultValue: false, help: "Edit placeholder progressively as LLM generates" },
    { key: "group_stream",    label: "Group Streaming",            type: "boolean", defaultValue: false },
    { key: "block_reply",     label: "Block Reply",                type: "select",  options: blockReplyOptions, defaultValue: "inherit", help: "Deliver intermediate text during tool iterations" },
  ],
  discord: [
    { key: "dm_policy",       label: "DM Policy",                  type: "select",  options: dmPolicyOptions,    defaultValue: "pairing" },
    { key: "group_policy",    label: "Group Policy",               type: "select",  options: groupPolicyOptions, defaultValue: "pairing" },
    { key: "require_mention", label: "Require @mention in groups", type: "boolean", defaultValue: true },
    { key: "allow_from",      label: "Allowed Users",              type: "tags",    help: "Discord user IDs, one per line" },
    { key: "history_limit",   label: "Group History Limit",        type: "number",  defaultValue: 50 },
    { key: "block_reply",     label: "Block Reply",                type: "select",  options: blockReplyOptions, defaultValue: "inherit" },
  ],
  slack: [
    { key: "dm_policy",       label: "DM Policy",                    type: "select",  options: dmPolicyOptions,    defaultValue: "pairing" },
    { key: "group_policy",    label: "Group Policy",                 type: "select",  options: groupPolicyOptions, defaultValue: "pairing" },
    { key: "require_mention", label: "Require @mention in channels", type: "boolean", defaultValue: true },
    { key: "allow_from",      label: "Allowed Users",                type: "tags",    help: "Slack user IDs (U...), one per line" },
    { key: "history_limit",   label: "Group History Limit",          type: "number",  defaultValue: 50 },
    { key: "dm_stream",       label: "DM Streaming",                 type: "boolean", defaultValue: false },
    { key: "group_stream",    label: "Group Streaming",              type: "boolean", defaultValue: false },
    { key: "block_reply",     label: "Block Reply",                  type: "select",  options: blockReplyOptions, defaultValue: "inherit" },
  ],
  feishu: [
    { key: "dm_policy",       label: "DM Policy",                  type: "select",  options: dmPolicyOptions,    defaultValue: "pairing" },
    { key: "group_policy",    label: "Group Policy",               type: "select",  options: groupPolicyOptions, defaultValue: "pairing" },
    { key: "require_mention", label: "Require @mention in groups", type: "boolean", defaultValue: true },
    { key: "allow_from",      label: "Allowed Users",              type: "tags",    help: "Lark open_ids (ou_...), one per line" },
    { key: "block_reply",     label: "Block Reply",                type: "select",  options: blockReplyOptions, defaultValue: "inherit" },
  ],
  zalo_oa: [
    { key: "dm_policy",  label: "DM Policy",     type: "select",  options: dmPolicyOptions,  defaultValue: "pairing" },
    { key: "allow_from", label: "Allowed Users", type: "tags",    help: "Zalo user IDs, one per line" },
    { key: "block_reply", label: "Block Reply",  type: "select",  options: blockReplyOptions, defaultValue: "inherit" },
  ],
  zalo_personal: [
    { key: "dm_policy",       label: "DM Policy",                  type: "select",  options: dmPolicyOptions,    defaultValue: "allowlist" },
    { key: "group_policy",    label: "Group Policy",               type: "select",  options: groupPolicyOptions, defaultValue: "allowlist" },
    { key: "require_mention", label: "Require @mention in groups", type: "boolean", defaultValue: true },
    { key: "allow_from",      label: "Allowed Users",              type: "tags",    help: "Zalo user IDs or group IDs, one per line" },
    { key: "block_reply",     label: "Block Reply",                type: "select",  options: blockReplyOptions, defaultValue: "inherit" },
  ],
  whatsapp: [
    { key: "dm_policy",    label: "DM Policy",    type: "select",  options: dmPolicyOptions,    defaultValue: "pairing" },
    { key: "group_policy", label: "Group Policy", type: "select",  options: groupPolicyOptions, defaultValue: "pairing" },
    { key: "allow_from",   label: "Allowed Users", type: "tags",   help: "WhatsApp user IDs, one per line" },
    { key: "block_reply",  label: "Block Reply",   type: "select", options: blockReplyOptions, defaultValue: "inherit" },
  ],
};
