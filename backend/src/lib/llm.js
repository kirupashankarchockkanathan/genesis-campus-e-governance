import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/index.js';
import { logger } from './logger.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

/** Groq client (OpenAI-compatible chat API, no extra package needed). */
export function createGroqClient() {
  const model = config.LLM_MODEL || 'llama-3.3-70b-versatile';
  return {
    provider: 'groq',
    model,
    /** `messages` is [{ role, content }]; resolves to { text, refused }. Throws on API failure or timeout. */
    async ask({ system, messages, signal }) {
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.GROQ_API_KEY}` },
        body: JSON.stringify({
          model,
          max_tokens: 700,
          temperature: 0.3,
          messages: [{ role: 'system', content: system }, ...messages],
        }),
        signal: signal ?? AbortSignal.timeout(config.CHAT_TIMEOUT_MS),
      });
      if (!res.ok) {
        const err = new Error(`Groq API error ${res.status}`);
        err.status = res.status;
        throw err;
      }
      const data = await res.json();
      const choice = data.choices?.[0];
      if (choice?.finish_reason === 'content_filter') return { text: '', refused: true };
      return { text: (choice?.message?.content ?? '').trim(), refused: false };
    },
  };
}

/**
 * Chat model client. The key stays on the server and never reaches the browser.
 * GROQ_API_KEY selects Groq, otherwise ANTHROPIC_API_KEY selects Claude. With neither the chat answers with built-in
 * rules (the callers receive null). Tests inject their own `{ ask }` object instead.
 */
export function createLlmClient() {
  if (config.GROQ_API_KEY) return createGroqClient();
  if (!config.ANTHROPIC_API_KEY) return null;
  const client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY, maxRetries: 1 });
  const model = config.LLM_MODEL || 'claude-opus-5-5';

  return {
    provider: 'anthropic',
    model,
    /** `messages` is [{ role, content }]; resolves to { text, refused }. Throws on API failure or timeout. */
    async ask({ system, messages, signal }) {
      const response = await client.beta.messages.create(
        {
          model,
          max_tokens: 1024,
          system,
          messages,
          // Short factual answers: low effort keeps latency and cost down.
          output_config: { effort: 'low' },
          // Opt in to server-side fallback so a policy decline is retried on another model automatically.
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
        },
        { signal, timeout: config.CHAT_TIMEOUT_MS },
      );
      if (response.stop_reason === 'refusal') return { text: '', refused: true };
      const text = response.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
      return { text, refused: false };
    },
  };
}

let shared;
export function getLlm() {
  if (shared === undefined) {
    try {
      shared = createLlmClient();
    } catch (err) {
      logger.error({ err }, 'could not create the model client');
      shared = null;
    }
  }
  return shared;
}
