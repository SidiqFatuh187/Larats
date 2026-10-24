import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');

const testsDir = path.resolve('tests');
const files = fs
  .readdirSync(testsDir)
  .filter((f) => f.endsWith('.test.ts'))
  .sort()
  .map((f) => path.join('tests', f));

if (files.length === 0) {
  console.error('No test files found in tests/');
  process.exit(1);
}

const child = spawn(process.execPath, [tsxCli, '--test', ...files], {
  stdio: 'inherit',
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
