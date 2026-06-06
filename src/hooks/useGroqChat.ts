/**
 * hooks/useGroqChat.ts
 *
 * Manages the AI chat state and communicates with Groq's cloud API.
 * API key is read from localStorage (set via Settings modal).
 */

import { useState, useCallback, useRef } from "react";
import type { ChatMessage } from "../types";

const GROQ_MODEL = "llama-3.1-8b-instant";

function getGroqApiKey(): string {
  return localStorage.getItem("orbit_groq_key") ?? "";
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export interface UseGroqChatReturn {
  messages: ChatMessage[];
  isStreaming: boolean;
  error: string | null;
  sendMessage: (userText: string, ragContext?: string) => Promise<void>;
  clearMessages: () => void;
  setSystemPrompt: (prompt: string) => void;
}

const DEFAULT_SYSTEM_PROMPT = `You are Orbit, a helpful AI assistant embedded in a local-first desktop tracking application.
You help users manage branch delivery schedules, to-do tasks, and operational data.
When relevant context from the local database is provided, use it to give precise, grounded answers.
Be concise and practical. Format data clearly when presenting schedules or task lists.`;

export function useGroqChat(): UseGroqChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const systemPromptRef = useRef(DEFAULT_SYSTEM_PROMPT);
  const abortRef = useRef<AbortController | null>(null);

  const setSystemPrompt = useCallback((prompt: string) => {
    systemPromptRef.current = prompt;
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const sendMessage = useCallback(
    async (userText: string, ragContext?: string) => {
      const apiKey = getGroqApiKey();
      if (!apiKey) {
        setError("No Groq API key set. Add it in Settings (gear icon).");
        return;
      }

      abortRef.current?.abort();
      abortRef.current = new AbortController();

      setError(null);

      const enrichedContent = ragContext
        ? `${ragContext}\n\nUser question: ${userText}`
        : userText;

      const userMsg: ChatMessage = {
        id: uid(),
        role: "user",
        content: userText,
        timestamp: Date.now(),
      };

      const assistantMsg: ChatMessage = {
        id: uid(),
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        streaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      try {
        const historyForApi = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const response = await fetch(
          "https://api.groq.com/openai/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            signal: abortRef.current.signal,
            body: JSON.stringify({
              model: GROQ_MODEL,
              stream: true,
              max_tokens: 1024,
              messages: [
                { role: "system", content: systemPromptRef.current },
                ...historyForApi,
                { role: "user", content: enrichedContent },
              ],
            }),
          },
        );

        if (!response.ok) {
          const errBody = await response.text();
          throw new Error(`Groq API error ${response.status}: ${errBody}`);
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n").filter((l) => l.startsWith("data:"));

          for (const line of lines) {
            const data = line.slice(5).trim();
            if (data === "[DONE]") break;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content ?? "";
              accumulated += delta;

              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id ? { ...m, content: accumulated } : m,
                ),
              );
            } catch {
              // Malformed JSON chunk — skip
            }
          }
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, streaming: false } : m,
          ),
        );
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        const msg = err instanceof Error ? err.message : "Chat request failed";
        setError(msg);
        setMessages((prev) => prev.filter((m) => m.id !== assistantMsg.id));
      } finally {
        setIsStreaming(false);
      }
    },
    [messages],
  );

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    clearMessages,
    setSystemPrompt,
  };
}
