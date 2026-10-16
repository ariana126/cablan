import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Config } from 'jest';

// The unit suite's config is package.json's "jest" block (rootDir `src`).
// Reusing it keeps the path aliases (moduleNameMapper) and the ts-jest
// transform declared once; only where to look and what to match differ.
// (Jest loads this file as ESM, so __dirname is unavailable; npm runs it from the project root.)
const { jest: unitConfig } = JSON.parse(
  readFileSync(join(process.cwd(), 'package.json'), 'utf8'),
) as { jest: Config };

const config: Config = {
  ...unitConfig,
  roots: ['<rootDir>/../test/integration'],
  testRegex: String.raw`.*\.int-spec\.ts$`,
  collectCoverageFrom: [],
  // One shared Postgres: run files one at a time.
  maxWorkers: 1,
  testTimeout: 30_000,
};

export default config;
