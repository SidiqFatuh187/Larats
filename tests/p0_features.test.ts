import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { scaffoldModule } from '../src/generator/scaffolder.js';
import { generateArchitectureMarkdown, generateMermaidDiagram } from '../src/generator/markdown.js';
import type { ScanResult } from '../src/scanner.js';
import type { ProjectInfo } from '../src/detector.js';

test('P0-5: Scaffolding twice does not create duplicate migrations', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'larats-p0-5-'));

  try {
    const projectInfo: ProjectInfo = {
      type: 'laravel',
      name: 'test-laravel',
      rootPath: tempDir,
      summary: 'Laravel',
      laravel: {
        hasFilament: false,
        hasLivewire: false,
        hasInertia: false,
        hasSanctum: false,
        isModular: false,
      },
    };

    // First scaffold run
    const res1 = await scaffoldModule(projectInfo, {
      moduleName: 'Order',
      components: ['model', 'migration'],
      isModular: false,
    });
    assert.equal(res1.createdCount, 2);
    assert.equal(res1.skippedCount, 0);

    const migrationsDir = path.join(tempDir, 'database', 'migrations');
    const initialMigrations = fs.readdirSync(migrationsDir).filter((f) => f.includes('create_orders_table'));
    assert.equal(initialMigrations.length, 1);

    // Second scaffold run immediately after
    const res2 = await scaffoldModule(projectInfo, {
      moduleName: 'Order',
      components: ['model', 'migration'],
      isModular: false,
    });

    // Both model AND migration should be skipped!
    assert.equal(res2.createdCount, 0, 'Second run must not create any files');
    assert.equal(res2.skippedCount, 2, 'Both files should be reported as skipped');

    const finalMigrations = fs.readdirSync(migrationsDir).filter((f) => f.includes('create_orders_table'));
    assert.equal(finalMigrations.length, 1, 'Exactly 1 migration file must exist after repeated run');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('P0-6: generateArchitectureMarkdown is deterministic and excludes volatile timestamp and duration', () => {
  const scanResult1: ScanResult = {
    projectInfo: {
      type: 'typescript',
      name: 'deterministic-test',
      rootPath: '/dummy/path',
      summary: 'TypeScript (express)',
    },
    totalFilesScanned: 10,
    components: {
      Controllers: { name: 'Controllers', count: 1, files: ['src/user.controller.ts'], description: 'Controllers' },
    },
    modules: ['user'],
    directoryTree: 'src/\n└── user.controller.ts',
    scanDurationMs: 42,
  };

  const scanResult2: ScanResult = {
    ...scanResult1,
    scanDurationMs: 9999, // different duration
  };

  const md1 = generateArchitectureMarkdown(scanResult1);
  const md2 = generateArchitectureMarkdown(scanResult2);

  assert.equal(md1, md2, 'Markdown output must be byte-identical regardless of scan duration');
  assert.doesNotMatch(md1, /UTC/, 'Must not contain timestamp in file content');
  assert.doesNotMatch(md1, /42\s*ms/, 'Must not contain duration in file content');
  assert.doesNotMatch(md1, /\/dummy\/path/, 'Must never contain absolute path in markdown');
});

test('P0-7: TS project without web layers falls back to generic dynamic diagram', () => {
  const scanResult: ScanResult = {
    projectInfo: {
      type: 'typescript',
      name: 'my-cli-tool',
      rootPath: '/repo',
      summary: 'TypeScript (node-vanilla)',
      typescript: {
        framework: 'node-vanilla',
        hasPrisma: false,
        hasTypeORM: false,
        hasDrizzle: false,
        isMonorepo: false,
        isModular: false,
        srcDir: 'src',
      },
    },
    totalFilesScanned: 5,
    components: {
      'Source Files': { name: 'Source Files', count: 3, files: ['src/index.ts', 'src/cli.ts'], description: 'Source' },
      'Test Files': { name: 'Test Files', count: 2, files: ['tests/cli.test.ts'], description: 'Tests' },
    },
    modules: [],
    directoryTree: 'src/\ntests/',
    scanDurationMs: 10,
  };

  const mermaid = generateMermaidDiagram(scanResult);

  assert.doesNotMatch(mermaid, /Client --> Router/, 'Must not draw Web Client -> Router when no web layers exist');
  assert.match(mermaid, /CLI & Application Architecture|Application Architecture/, 'Must fall back to application/CLI diagram');
});
