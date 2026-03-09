// LLM provider type definitions — ported from goclaw ui/web/src/constants/providers.ts

export interface ProviderTypeInfo {
  value: string;
  label: string;
  apiBase: string; // pre-filled default; user can override
}

export const PROVIDER_TYPES: ProviderTypeInfo[] = [
  { value: "anthropic_native", label: "Anthropic (Native)",        apiBase: "" },
  { value: "openai_compat",    label: "OpenAI Compatible",         apiBase: "" },
  { value: "gemini_native",    label: "Google Gemini",             apiBase: "https://generativelanguage.googleapis.com/v1beta/openai" },
  { value: "openrouter",       label: "OpenRouter",                apiBase: "https://openrouter.ai/api/v1" },
  { value: "groq",             label: "Groq",                      apiBase: "https://api.groq.com/openai/v1" },
  { value: "deepseek",         label: "DeepSeek",                  apiBase: "https://api.deepseek.com/v1" },
  { value: "mistral",          label: "Mistral AI",                apiBase: "https://api.mistral.ai/v1" },
  { value: "xai",              label: "xAI (Grok)",                apiBase: "https://api.x.ai/v1" },
  { value: "minimax_native",   label: "MiniMax (Native)",          apiBase: "https://api.minimax.io/v1" },
  { value: "cohere",           label: "Cohere",                    apiBase: "https://api.cohere.ai/compatibility/v1" },
  { value: "perplexity",       label: "Perplexity",                apiBase: "https://api.perplexity.ai" },
  { value: "dashscope",        label: "DashScope (Qwen)",          apiBase: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1" },
  { value: "yescale",          label: "YesScale",                  apiBase: "https://api.yescale.one/v1" },
];
