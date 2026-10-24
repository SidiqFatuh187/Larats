import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { scaffoldModule } from '../src/generator/scaffolder.js';
import { scanProject } from '../src/scanner.js';
import { detectProjectType, type ProjectInfo } from '../src/detector.js';

test('P0-3: Scanner detects modular Laravel components and excludes loose files from modules', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'larats-p0-3-'));

  try {
    const projectInfo: ProjectInfo = {
      type: 'laravel',
      name: 'modular-laravel',
      rootPath: tempDir,
      summary: 'Laravel (Modular)',
      laravel: {
        hasFilament: false,
        hasLivewire: false,
        hasInertia: false,
        hasSanctum: false,
        isModular: true,
        modulesDir: 'app/Modules',
      },
    };

    // 1. Scaffold modular Payment module
    const scaffoldRes = await scaffoldModule(projectInfo, {
      moduleName: 'Payment',
      components: ['model', 'controller', 'service'],
      isModular: true,
    });
    assert.equal(scaffoldRes.createdCount, 3);

    // 2. Add a loose file in app/Modules (should NOT be detected as a module)
    fs.writeFileSync(path.join(tempDir, 'app', 'Modules', 'LooseServiceProvider.php'), '<?php');

    // 3. Add a file with Model suffix in Controllers (should NOT be detected as Model)
    fs.mkdirSync(path.join(tempDir, 'app', 'Http', 'Controllers'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'app', 'Http', 'Controllers', 'DataModel.php'), '<?php');

    // 4. Scan
    const scanRes = await scanProject(projectInfo);

    assert.equal(scanRes.components['Models']?.count, 1, 'DataModel in Controllers must not be counted as a Model');
    assert.equal(scanRes.components['Controllers']?.count, 2, 'PaymentController and DataModel in Controllers should be counted');
    assert.equal(scanRes.components['Services']?.count, 1, 'Only Payment service should be counted');
    assert.deepEqual(scanRes.modules, ['Payment'], 'LooseServiceProvider must not be counted as a module');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('P0-4: TS scanner supports custom srcDir, monorepo paths, and suffix-free layered files', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'larats-p0-4-'));

  try {
    // Monorepo app structure with suffix-free files: apps/api/src/controllers/user.ts
    const ctrlPath = path.join(tempDir, 'apps', 'api', 'src', 'controllers');
    const srvPath = path.join(tempDir, 'packages', 'core', 'src', 'services');
    fs.mkdirSync(ctrlPath, { recursive: true });
    fs.mkdirSync(srvPath, { recursive: true });

    fs.writeFileSync(path.join(ctrlPath, 'user.ts'), 'export class User {}');
    fs.writeFileSync(path.join(srvPath, 'auth.ts'), 'export class Auth {}');

    const projectInfo: ProjectInfo = {
      type: 'typescript',
      name: 'monorepo-app',
      rootPath: tempDir,
      summary: 'TypeScript (Monorepo)',
      typescript: {
        framework: 'express',
        hasPrisma: false,
        hasTypeORM: false,
        hasDrizzle: false,
        isMonorepo: true,
        isModular: false,
        srcDir: 'src',
      },
    };

    const scanRes = await scanProject(projectInfo);

    assert.equal(scanRes.components['Controllers']?.count, 1, 'apps/api/src/controllers/user.ts must be detected as Controller');
    assert.equal(scanRes.components['Services']?.count, 1, 'packages/core/src/services/auth.ts must be detected as Service');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('P0-4: TS scanner populates Source Files and Test Files when no web layers exist', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'larats-p0-4-generic-'));

  try {
    fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'tests'), { recursive: true });

    fs.writeFileSync(path.join(tempDir, 'src', 'index.ts'), 'console.log("hi");');
    fs.writeFileSync(path.join(tempDir, 'tests', 'index.test.ts'), 'test("ok");');

    const projectInfo: ProjectInfo = {
      type: 'typescript',
      name: 'cli-tool',
      rootPath: tempDir,
      summary: 'TypeScript',
      typescript: {
        framework: 'node-vanilla',
        hasPrisma: false,
        hasTypeORM: false,
        hasDrizzle: false,
        isMonorepo: false,
        isModular: false,
        srcDir: 'src',
      },
    };

    const scanRes = await scanProject(projectInfo);

    assert.equal(scanRes.components['Source Files']?.count, 1);
    assert.equal(scanRes.components['Test Files']?.count, 1);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
