import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

/**
 * Points the engine at a throwaway database so tests never touch the real
 * one. Must run before the modules that read config are imported.
 */
export function useTempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ww-marketing-test-'));
  process.env.MARKETING_DB_PATH = path.join(dir, 'test.db');
  return dir;
}
