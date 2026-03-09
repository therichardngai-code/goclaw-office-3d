// Streaming chat with a goclaw agent via POST /v1/chat/completions (OpenAI-compatible SSE)
import { apiURL } from "@/lib/config";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const getHeaders = (agentKey: string): Record<string, string> => ({
  Authorization: `Bearer ${localStorage.getItem("goclaw:token") ?? ""}`,
  "X-GoClaw-User-Id": localStorage.getItem("goclaw:userId") ?? "default",
  "X-GoClaw-Agent-Id": agentKey,
  "Content-Type": "application/json",
});

// Stream a chat message to an agent. Calls onChunk with each new token,
// then onDone with the complete response content. Returns cleanup function.
export function streamChat(
  agentKey: string,
  messages: ChatMessage[],
  onChunk: (token: string) => void,
  onDone: (fullContent: string) => void,
  onError: (err: string) => void
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(apiURL("/v1/chat/completions"), {
        method: "POST",
        headers: getHeaders(agentKey),
        body: JSON.stringify({ model: `goclaw:${agentKey}`, messages, stream: true }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        onError(`Agent error (${res.status}): ${text || res.statusText}`);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) { onError("No response body"); return; }

      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const token = parsed.choices?.[0]?.delta?.content ?? "";
            if (token) {
              fullContent += token;
              onChunk(token);
            }
          } catch {
            // malformed SSE chunk — skip
          }
        }
      }

      onDone(fullContent);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        onError(String(err));
      }
    }
  })();

  // Return cancel function
  return () => controller.abort();
}
