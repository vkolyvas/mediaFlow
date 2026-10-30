import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { env, requireEnv } from './config.mjs';

/**
 * Postiz integration.
 *
 * The engine talks to Postiz through its official CLI (`postiz`, npm package)
 * rather than the HTTP API directly. The CLI already handles the awkward
 * parts: OAuth credentials, provider-specific settings, and the rule that
 * media must be uploaded to Postiz before it can be published - Instagram
 * and Facebook reject anything that is not a Postiz-verified URL.
 *
 * Everything here shells out to the CLI, so the same commands work by hand
 * when something needs to be checked.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_BIN = path.resolve(here, '..', 'node_modules', '.bin', 'postiz');

export class PostizError extends Error {
  constructor(message, { stdout, stderr, code } = {}) {
    super(message);
    this.name = 'PostizError';
    this.stdout = stdout;
    this.stderr = stderr;
    this.code = code;
  }
}

function binary() {
  if (fs.existsSync(LOCAL_BIN)) return LOCAL_BIN;
  return 'postiz';
}

/** Runs the CLI and returns its stdout. */
export function run(args, { timeoutMs = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary(), args, {
      env: {
        ...process.env,
        POSTIZ_API_URL: env.postizApiUrl,
        POSTIZ_API_KEY: env.postizApiKey,
      },
      cwd: process.cwd(),
    });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new PostizError(`postiz ${args[0]} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new PostizError(`could not run the postiz CLI: ${err.message}`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new PostizError(`postiz ${args[0]} exited with code ${code}: ${stderr.trim() || stdout.trim()}`, {
          stdout,
          stderr,
          code,
        }));
        return;
      }
      resolve(stdout);
    });
  });
}

/**
 * The CLI prints a friendly line before its JSON payload, so the JSON has to
 * be pulled out of the output rather than parsed wholesale.
 */
export function parseJsonOutput(stdout) {
  const text = String(stdout || '').trim();
  if (!text) return null;

  const start = text.search(/[[{]/);
  if (start === -1) return null;

  const candidate = text.slice(start);
  try {
    return JSON.parse(candidate);
  } catch {
    // Fall back to the last complete JSON block in the output.
    for (let end = candidate.length; end > 0; end -= 1) {
      const slice = candidate.slice(0, end).trim();
      if (!slice) continue;
      try {
        return JSON.parse(slice);
      } catch {
        /* keep shrinking */
      }
    }
  }
  throw new PostizError(`could not parse the postiz output as JSON:\n${text.slice(0, 500)}`);
}

/** Every channel connected to the Postiz instance. */
export async function listIntegrations() {
  requireEnv('postizApiKey');
  const stdout = await run(['integrations:list']);
  const parsed = parseJsonOutput(stdout);
  const list = Array.isArray(parsed) ? parsed : parsed?.output || parsed?.integrations || [];
  return Array.isArray(list) ? list : [];
}

/**
 * Finds the integration id for a platform.
 * Instagram and Facebook are both reached through the Facebook provider, so
 * the identifier is matched on both the provider name and the platform.
 */
export async function findIntegration(platform) {
  const wanted = platform.toLowerCase();
  const integrations = await listIntegrations();

  const match = integrations.find((integration) => {
    const identifier = String(integration.identifier || '').toLowerCase();
    const provider = String(integration.provider || '').toLowerCase();
    const name = String(integration.name || '').toLowerCase();
    if (identifier === wanted) return true;
    if (provider === wanted) return true;
    if (name.includes(wanted)) return true;
    // Facebook carries Instagram posts through the same provider.
    if (wanted === 'instagram' && (identifier.includes('instagram') || name.includes('instagram'))) return true;
    return false;
  });

  return match ? match.id || match.integrationIdentifier || null : null;
}

/**
 * Uploads a file to Postiz and returns the URL that must be used to publish
 * it. Raw local paths are not accepted by the publishing pipeline.
 */
export async function upload(filePath) {
  requireEnv('postizApiKey');
  const absolute = path.resolve(filePath);
  if (!fs.existsSync(absolute)) {
    throw new PostizError(`cannot upload "${absolute}": the file does not exist`);
  }
  const stdout = await run(['upload', absolute]);
  const parsed = parseJsonOutput(stdout);
  const result = parsed?.output || parsed;
  const uploadedPath = result?.path || result?.url || result?.file;
  if (!uploadedPath) {
    throw new PostizError(`postiz upload did not return a path:\n${String(stdout).slice(0, 300)}`);
  }
  return uploadedPath;
}

/**
 * Creates a scheduled post.
 *
 * `type` is 'schedule' with a date, or 'draft'. Nothing is published
 * immediately - the caller decides the date, and an immediate publish would
 * defeat the whole approval workflow.
 */
export async function createPost({ content, media = [], alt = [], integrationId, date, type = 'schedule' }) {
  requireEnv('postizApiKey');
  if (!content || !String(content).trim()) {
    throw new PostizError('a post needs content');
  }
  if (!integrationId) {
    throw new PostizError('a post needs an integration id');
  }

  const args = ['posts:create', '-c', content, '-i', integrationId];
  if (media.length) args.push('-m', media.join(','));
  if (alt.length) args.push('--alt', alt.join(','));
  if (type === 'draft') {
    args.push('-t', 'draft');
  } else {
    if (!date) throw new PostizError('a scheduled post needs a date');
    args.push('-s', new Date(date).toISOString());
  }

  const stdout = await run(args);
  const parsed = parseJsonOutput(stdout);
  const result = parsed?.output || parsed;
  return {
    id: result?.id || result?.post?.id || null,
    raw: result,
  };
}

/** The posts Postiz knows about. */
export async function listPosts() {
  requireEnv('postizApiKey');
  const stdout = await run(['posts:list']);
  const parsed = parseJsonOutput(stdout);
  const list = Array.isArray(parsed) ? parsed : parsed?.output || parsed?.posts || [];
  return Array.isArray(list) ? list : [];
}

/** Platform-level analytics for one channel. */
export async function platformAnalytics(integrationId, days = 30) {
  requireEnv('postizApiKey');
  const stdout = await run(['analytics:platform', integrationId, '-d', String(days)]);
  const parsed = parseJsonOutput(stdout);
  return parsed?.output || parsed || null;
}

/** Analytics for one post. */
export async function postAnalytics(postId, days = 7) {
  requireEnv('postizApiKey');
  const stdout = await run(['analytics:post', postId, '-d', String(days)]);
  const parsed = parseJsonOutput(stdout);
  return parsed?.output || parsed || null;
}

/** Whether the CLI can reach Postiz at all. */
export async function checkConnection() {
  try {
    const integrations = await listIntegrations();
    return { ok: true, integrations: integrations.length };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
