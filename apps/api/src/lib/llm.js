import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/index.js';
import { logger } from './logger.js';

/**
 * Claude client for the chatbot (spec 14). The key stays on the server and never reaches the browser.
 * Returns null when ANTHROPIC_API_KEY is not set, in which case the chatbot answers from portal data only.
 * Tests inject their own `{ ask }` object instead (spec 14 "Tests: mocked model client").
 */
export function createLlmClient() {
  if (!config.ANTHROPIC_API_KEY) return null;
  const client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY, maxRetries: 1 });
  const model = config.LLM_MODEL || 'claude-opus-5-5';

  return {
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
