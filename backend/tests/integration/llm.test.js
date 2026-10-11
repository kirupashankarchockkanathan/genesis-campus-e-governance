import { describe, it, expect, afterEach, vi } from 'vitest';
import { overrideConfig } from '../../src/config/index.js';
import { createLlmClient } from '../../src/lib/llm.js';

afterEach(() => {
  vi.unstubAllGlobals();
  overrideConfig({ GROQ_API_KEY: '', ANTHROPIC_API_KEY: '', LLM_MODEL: '' });
});

describe('chat model client', () => {
  it('is off without a key, and Groq when GROQ_API_KEY is set', () => {
    expect(createLlmClient()).toBeNull();
    overrideConfig({ GROQ_API_KEY: 'gsk_test' });
    expect(createLlmClient()).toMatchObject({ provider: 'groq', model: 'openai/gpt-oss-120b' });
    overrideConfig({ LLM_MODEL: 'llama-3.1-8b-instant' });
    expect(createLlmClient().model).toBe('llama-3.1-8b-instant');
  });

  it('sends the system prompt and messages to Groq and returns the text', async () => {
    overrideConfig({ GROQ_API_KEY: 'gsk_test' });
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: ' Hi there. ' }, finish_reason: 'stop' }] }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const out = await createLlmClient().ask({
      system: 'Be brief.',
      messages: [{ role: 'user', content: 'hello' }],
    });
    expect(out).toEqual({ text: 'Hi there.', refused: false });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer gsk_test');
    const body = JSON.parse(init.body);
    expect(body.messages).toEqual([
      { role: 'system', content: 'Be brief.' },
      { role: 'user', content: 'hello' },
    ]);
  });

  it('throws on an API error so the chat falls back to its rules', async () => {
    overrideConfig({ GROQ_API_KEY: 'gsk_test' });
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 401 }));
    await expect(createLlmClient().ask({ system: 's', messages: [] })).rejects.toThrow(/401/);
  });
});
