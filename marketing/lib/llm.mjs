import { env, requireEnv } from './config.mjs';

const API_URL = 'https://api.anthropic.com/v1/messages';

/**
 * Anthropic client.
 *
 * The engine deliberately talks to the API directly with fetch rather than
 * pulling in an SDK: one endpoint, one request shape, no dependency to keep
 * in sync. It mirrors the provider contract already used by the mediaFlow
 * backend (backend/app/ai/base.py) - a single `generate(prompt)` call - but
 * adds the two things content generation actually needs: a system prompt and
 * a JSON response mode.
 */
export class LLMError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = 'LLMError';
    this.status = status;
    this.body = body;
  }
}

async function callApi({ prompt, system, model, maxTokens, temperature }) {
  requireEnv('anthropicApiKey');

  const body = {
    model: model || env.defaultModel,
    max_tokens: maxTokens || env.maxTokens,
    messages: [{ role: 'user', content: prompt }],
  };
  if (system) body.system = system;
  if (typeof temperature === 'number') body.temperature = temperature;

  let res;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new LLMError(`Anthropic request failed: ${err.message}`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new LLMError(`Anthropic API ${res.status}: ${text.slice(0, 500)}`, {
      status: res.status,
      body: text,
    });
  }

  const json = await res.json();
  const text = (json.content || [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();
  if (!text) throw new LLMError('Anthropic returned an empty response');
  return text;
}

/**
 * Calls the model with exponential backoff on transient failures.
 * Retries are safe here: generation is pure, there is no side effect.
 */
export async function generate(prompt, { system, model, maxTokens, temperature, retries = 3 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await callApi({ prompt, system, model, maxTokens, temperature });
    } catch (err) {
      lastError = err;
      const retryable = err.status === 429 || err.status >= 500 || !err.status;
      if (!retryable || attempt === retries) break;
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
  throw lastError;
}

/**
 * Asks for JSON and parses it.
 *
 * Models sometimes wrap JSON in a fenced block or add a sentence of prose
 * around it, so the raw text is cleaned up before parsing. If it still is not
 * valid JSON the error is surfaced with the offending text, because a silent
 * fallback here would mean publishing an empty post.
 */
export async function generateJson(prompt, options = {}) {
  const raw = await generate(prompt, options);
  const cleaned = raw
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        /* fall through to the error below */
      }
    }
    throw new LLMError(`Model did not return valid JSON. Raw output: ${raw.slice(0, 800)}`);
  }
}
