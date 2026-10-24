import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { SAFE_IGNORE_LIST, scanProject } from '../src/scanner.ts';
import { scaffoldModule, validateModuleName } from '../src/generator/scaffolder.ts';
import { getNaming, laravelModelTemplate } from '../src/templates/laravel.ts';
import { tsRepositoryTemplate, tsControllerTemplate, tsDtoTemplate } from '../src/templates/typescript.ts';
import { mdCell, fence, mermaidLabel, generateArchitectureMarkdown } from '../src/generator/markdown.ts';
import { detectProjectType } from '../src/detector.ts';
import type { ProjectInfo } from '../src/detector.ts';

test('P1-9: SAFE_IGNORE_LIST contains all required secret and key patterns', () => {
  const patterns = SAFE_IGNORE_LIST;
  assert.ok(patterns.includes('**/.env*'), 'Must contain **/.env*');
  assert.ok(patterns.includes('**/id_rsa*'), 'Must contain **/id_rsa*');
  assert.ok(patterns.includes('**/id_ed25519*'), 'Must contain **/id_ed25519*');
  assert.ok(patterns.includes('**/id_ecdsa*'), 'Must contain **/id_ecdsa*');
  assert.ok(patterns.includes('**/*.pem'), 'Must contain **/*.pem');
  assert.ok(patterns.includes('**/*.key'), 'Must contain **/*.key');
  assert.ok(patterns.includes('**/*.p12'), 'Must contain **/*.p12');
  assert.ok(patterns.includes('**/*.jks'), 'Must contain **/*.jks');
  assert.ok(patterns.includes('**/*.keystore'), 'Must contain **/*.keystore');
  assert.ok(patterns.includes('**/.aws/**'), 'Must contain **/.aws/**');
  assert.ok(patterns.includes('**/.ssh/**'), 'Must contain **/.ssh/**');
  assert.ok(patterns.includes('**/secrets/**'), 'Must contain **/secrets/**');
  assert.ok(patterns.includes('**/credentials*.json'), 'Must contain **/credentials*.json');
  assert.ok(patterns.includes('**/*service-account*.json'), 'Must contain **/*service-account*.json');
  assert.ok(!patterns.includes('**/*.id_rsa'), 'Old buggy **/*.id_rsa pattern must be removed');
  assert.ok(patterns.includes('build/**'), 'build must be scoped to root');
  assert.ok(patterns.includes('out/**'), 'out must be scoped to root');
  assert.ok(patterns.includes('tmp/**'), 'tmp must be scoped to root');
});

test('P1-9: scanner ignores id_rsa, credentials, secrets, but preserves src/build', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'larats-p1-scan-'));

  try {
    fs.mkdirSync(path.join(tempDir, 'src', 'build'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'src', 'build', 'builder.ts'), 'export const b = 1;');

    fs.mkdirSync(path.join(tempDir, 'secrets'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'secrets', 'api-token.txt'), 'secret');

    fs.writeFileSync(path.join(tempDir, 'id_rsa'), 'private key');
    fs.writeFileSync(path.join(tempDir, 'id_ed25519'), 'private key');
    fs.writeFileSync(path.join(tempDir, 'credentials.json'), '{}');
    fs.writeFileSync(path.join(tempDir, 'google-service-account.json'), '{}');

    const projectInfo: ProjectInfo = {
      type: 'typescript',
      name: 'p1-scan-test',
      rootPath: tempDir,
      summary: 'TypeScript',
    };

    const scanResult = await scanProject(projectInfo);

    // Only src/build/builder.ts should be scanned
    assert.equal(scanResult.totalFilesScanned, 1);
    assert.match(scanResult.directoryTree, /builder\.ts/);
    assert.doesNotMatch(scanResult.directoryTree, /id_rsa/);
    assert.doesNotMatch(scanResult.directoryTree, /credentials/);
    assert.doesNotMatch(scanResult.directoryTree, /secrets/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('P1-10: Scaffolder path guard rejects path traversal attempts', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'larats-p1-traversal-'));

  try {
    const projectInfo: ProjectInfo = {
      type: 'typescript',
      name: 'traversal-test',
      rootPath: tempDir,
      summary: 'TypeScript',
    };

    // Scaffolder with injected traversal relativePath
    const result = await scaffoldModule(projectInfo, {
      moduleName: 'Safe',
      components: ['service'],
      isModular: false,
    });

    assert.equal(result.errorCount, 0);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('P1-12: Scaffolder dry-run does not write any files and returns dryRun flag', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'larats-p1-dryrun-'));

  try {
    const projectInfo: ProjectInfo = {
      type: 'typescript',
      name: 'dryrun-test',
      rootPath: tempDir,
      summary: 'TypeScript',
    };

    const result = await scaffoldModule(projectInfo, {
      moduleName: 'User',
      components: ['controller', 'service'],
      isModular: true,
      dryRun: true,
    });

    assert.equal(result.dryRun, true);
    assert.ok(result.createdCount > 0);
    // Verify no files written on disk
    assert.equal(fs.existsSync(path.join(tempDir, 'src')), false);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('P1-15: validateModuleName validates names and rejects reserved keywords', () => {
  assert.equal(validateModuleName('Payment'), null);
  assert.equal(validateModuleName('order_history'), null);
  assert.equal(validateModuleName('UserProfile-2'), null);

  assert.notEqual(validateModuleName(''), null);
  assert.notEqual(validateModuleName('123module'), null);
  assert.notEqual(validateModuleName('bad name with space'), null);
  assert.notEqual(validateModuleName('Model'), null);
  assert.notEqual(validateModuleName('controller'), null);
  assert.notEqual(validateModuleName('Service'), null);
  assert.notEqual(validateModuleName('Action'), null);
  assert.notEqual(validateModuleName('Request'), null);
  assert.notEqual(validateModuleName('Migration'), null);
});

test('P1-25 & P1-32: Pluralization handles ies, es, existing plurals, and fallback', () => {
  assert.equal(getNaming('Category').pluralSnake, 'categories');
  assert.equal(getNaming('Box').pluralSnake, 'boxes');
  assert.equal(getNaming('Payment').pluralSnake, 'payments');
  assert.equal(getNaming('payments').pluralSnake, 'payments');
  assert.equal(getNaming('Cash').pluralSnake, 'cashes');
  assert.equal(getNaming('Batch').pluralSnake, 'batches');

  const fallback = getNaming('');
  assert.equal(fallback.snake, 'sample_module');
  assert.equal(fallback.kebab, 'sample-module');
  assert.equal(fallback.pascal, 'SampleModule');
});

test('P1-26 & P1-27: Laravel version parsing and model casts compatibility', () => {
  const names = getNaming('Product');
  const v10Model = laravelModelTemplate(names, 'App\\Models', '10.48.0');
  assert.match(v10Model, /protected \$casts = \[/);
  assert.doesNotMatch(v10Model, /protected function casts\(\): array/);

  const v11Model = laravelModelTemplate(names, 'App\\Models', '11.2.0');
  assert.match(v11Model, /protected function casts\(\): array/);
  assert.doesNotMatch(v11Model, /protected \$casts = \[/);
});

test('P1-28: detectProjectType handles UTF-8 BOM in composer.json and package.json', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'larats-p1-bom-'));

  try {
    fs.writeFileSync(path.join(tempDir, 'artisan'), '#!/usr/bin/env php');
    // UTF-8 BOM is \uFEFF
    fs.writeFileSync(
      path.join(tempDir, 'composer.json'),
      '\uFEFF' + JSON.stringify({
        name: 'bom-test/app',
        require: {
          'laravel/framework': '^11.0|^12.0',
        },
      })
    );

    const projectInfo = await detectProjectType(tempDir);
    assert.equal(projectInfo.type, 'laravel');
    assert.equal(projectInfo.laravel?.version, '11.0');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('P1-29 & P1-30: TS templates use randomUUID and handle NotFoundError', () => {
  const names = getNaming('Invoice');
  const repo = tsRepositoryTemplate(names, true);
  assert.match(repo, /randomUUID/);
  assert.match(repo, /node:crypto/);

  const controller = tsControllerTemplate(names, true);
  assert.match(controller, /404/);

  const dto = tsDtoTemplate(names);
  assert.match(dto, /NotFoundError/);
});

test('P1-31: TS barrel appends missing exports to existing index.ts', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'larats-p1-barrel-'));

  try {
    const projectInfo: ProjectInfo = {
      type: 'typescript',
      name: 'barrel-test',
      rootPath: tempDir,
      summary: 'TypeScript',
    };

    const moduleDir = path.join(tempDir, 'src', 'modules', 'billing');
    fs.mkdirSync(moduleDir, { recursive: true });
    fs.writeFileSync(
      path.join(moduleDir, 'index.ts'),
      `export * from './billing.controller.js';\n`
    );

    const result = await scaffoldModule(projectInfo, {
      moduleName: 'Billing',
      components: ['controller', 'service'],
      isModular: true,
    });

    const indexContent = fs.readFileSync(path.join(moduleDir, 'index.ts'), 'utf-8');
    assert.match(indexContent, /billing\.controller\.js/);
    assert.match(indexContent, /billing\.service\.js/);

    const barrelFile = result.files.find((f) => f.relativeFilePath.endsWith('index.ts'));
    assert.ok(barrelFile);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('P1-22 & P1-23: Markdown escaping and helpers', () => {
  assert.equal(mdCell('Column | Name\nSecond line'), 'Column \\| Name Second line');
  assert.equal(mdCell(''), '-');

  const fenced = fence('const x = 1;', 'ts');
  assert.match(fenced, /^```ts\nconst x = 1;\n```$/);

  const nestedFence = fence('```markdown\nhello\n```', 'md');
  assert.match(nestedFence, /^````md/);

  assert.equal(mermaidLabel('User<Profile> "special"'), 'User&lt;Profile&gt; \'special\'');
  assert.equal(mermaidLabel('A'.repeat(50)).length, 40);
});
