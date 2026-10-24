import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { scanProject, buildCleanDirectoryTree, SAFE_IGNORE_LIST } from '../src/scanner.js';
import type { ProjectInfo } from '../src/detector.js';

test('scanner strictly ignores sensitive files, secrets, node_modules, and logs', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'larats-safe-'));

  try {
    // Legitimate files
    fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'src', 'index.ts'), 'export const a = 1;');

    // Sensitive files that MUST be ignored
    fs.writeFileSync(path.join(tempDir, '.env'), 'SECRET_KEY=12345');
    fs.writeFileSync(path.join(tempDir, '.env.production'), 'DB_PASSWORD=secret');
    fs.writeFileSync(path.join(tempDir, 'app.key'), 'private-key');
    fs.writeFileSync(path.join(tempDir, 'server.pem'), 'cert');
    fs.writeFileSync(path.join(tempDir, 'debug.log'), 'error logs');
    fs.writeFileSync(path.join(tempDir, 'package-lock.json'), '{}');

    // Ignored directories
    fs.mkdirSync(path.join(tempDir, 'node_modules', 'foo'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'node_modules', 'foo', 'index.js'), 'bad');

    fs.mkdirSync(path.join(tempDir, '.git', 'objects'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, '.git', 'config'), 'git config');

    fs.mkdirSync(path.join(tempDir, 'storage', 'logs'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'storage', 'logs', 'laravel.log'), 'logs');

    const projectInfo: ProjectInfo = {
      type: 'typescript',
      name: 'secure-app',
      rootPath: tempDir,
      summary: 'TypeScript',
    };

    const scanResult = await scanProject(projectInfo);

    // Only src/index.ts should be scanned
    assert.equal(scanResult.totalFilesScanned, 1);
    assert.doesNotMatch(scanResult.directoryTree, /\.env/);
    assert.doesNotMatch(scanResult.directoryTree, /node_modules/);
    assert.doesNotMatch(scanResult.directoryTree, /\.git/);
    assert.doesNotMatch(scanResult.directoryTree, /\.key/);
    assert.doesNotMatch(scanResult.directoryTree, /\.pem/);
    assert.doesNotMatch(scanResult.directoryTree, /storage/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('scanner correctly categorizes Laravel components and modules', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'larats-laravel-components-'));

  try {
    fs.mkdirSync(path.join(tempDir, 'app', 'Models'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'app', 'Http', 'Controllers'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'app', 'Services'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'app', 'Actions'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'app', 'Http', 'Requests'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'app', 'Filament', 'Resources'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'routes'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'database', 'migrations'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'app', 'Modules', 'Billing'), { recursive: true });

    fs.writeFileSync(path.join(tempDir, 'app', 'Models', 'User.php'), '<?php');
    fs.writeFileSync(path.join(tempDir, 'app', 'Models', 'Order.php'), '<?php');
    fs.writeFileSync(path.join(tempDir, 'app', 'Http', 'Controllers', 'UserController.php'), '<?php');
    fs.writeFileSync(path.join(tempDir, 'app', 'Services', 'PaymentService.php'), '<?php');
    fs.writeFileSync(path.join(tempDir, 'app', 'Actions', 'CreateUserAction.php'), '<?php');
    fs.writeFileSync(path.join(tempDir, 'app', 'Http', 'Requests', 'UserRequest.php'), '<?php');
    fs.writeFileSync(path.join(tempDir, 'app', 'Filament', 'Resources', 'UserResource.php'), '<?php');
    fs.writeFileSync(path.join(tempDir, 'routes', 'web.php'), '<?php');
    fs.writeFileSync(path.join(tempDir, 'routes', 'api.php'), '<?php');
    fs.writeFileSync(path.join(tempDir, 'database', 'migrations', '2026_01_01_create_users_table.php'), '<?php');
    fs.writeFileSync(path.join(tempDir, 'app', 'Modules', 'Billing', 'BillingService.php'), '<?php');

    const projectInfo: ProjectInfo = {
      type: 'laravel',
      name: 'ecommerce-laravel',
      rootPath: tempDir,
      summary: 'Laravel 11.0 (Filament)',
      laravel: {
        hasFilament: true,
        hasLivewire: false,
        hasInertia: false,
        hasSanctum: true,
        isModular: true,
      },
    };

    const result = await scanProject(projectInfo);

    assert.equal(result.components['Models'].count, 2);
    assert.equal(result.components['Controllers'].count, 1);
    assert.equal(result.components['Services'].count, 1);
    assert.equal(result.components['Actions'].count, 1);
    assert.equal(result.components['Form Requests'].count, 1);
    assert.equal(result.components['Filament Resources'].count, 1);
    assert.equal(result.components['Routes'].count, 2);
    assert.equal(result.components['Migrations'].count, 1);
    assert.deepEqual(result.modules, ['Billing']);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('scanner correctly categorizes TypeScript modular components', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'larats-ts-components-'));

  try {
    fs.mkdirSync(path.join(tempDir, 'src', 'modules', 'auth'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'src', 'modules', 'payment'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'prisma'), { recursive: true });

    fs.writeFileSync(path.join(tempDir, 'src', 'modules', 'auth', 'auth.controller.ts'), '');
    fs.writeFileSync(path.join(tempDir, 'src', 'modules', 'auth', 'auth.service.ts'), '');
    fs.writeFileSync(path.join(tempDir, 'src', 'modules', 'auth', 'auth.repository.ts'), '');
    fs.writeFileSync(path.join(tempDir, 'src', 'modules', 'auth', 'auth.routes.ts'), '');
    fs.writeFileSync(path.join(tempDir, 'src', 'modules', 'auth', 'auth.dto.ts'), '');
    fs.writeFileSync(path.join(tempDir, 'src', 'modules', 'payment', 'payment.controller.ts'), '');
    fs.writeFileSync(path.join(tempDir, 'src', 'modules', 'payment', 'payment.service.ts'), '');
    fs.writeFileSync(path.join(tempDir, 'prisma', 'schema.prisma'), '');

    const projectInfo: ProjectInfo = {
      type: 'typescript',
      name: 'modular-api',
      rootPath: tempDir,
      summary: 'TypeScript (express, Prisma, Modular)',
      typescript: {
        framework: 'express',
        hasPrisma: true,
        hasTypeORM: false,
        hasDrizzle: false,
        isMonorepo: false,
        isModular: true,
        srcDir: 'src',
      },
    };

    const result = await scanProject(projectInfo);

    assert.equal(result.components['Controllers'].count, 2);
    assert.equal(result.components['Services'].count, 2);
    assert.equal(result.components['Repositories'].count, 1);
    assert.equal(result.components['Routes'].count, 1);
    assert.equal(result.components['DTOs & Schemas'].count, 1);
    assert.equal(result.components['Models & Entities'].count, 1); // prisma/schema.prisma
    assert.deepEqual(result.modules, ['auth', 'payment']);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('buildCleanDirectoryTree generates formatted tree structure', () => {
  const files = [
    'src/index.ts',
    'src/routes/api.ts',
    'src/controllers/user.controller.ts',
    'package.json',
  ];

  const tree = buildCleanDirectoryTree(files);
  assert.match(tree, /src\//);
  assert.match(tree, /package\.json/);
  assert.match(tree, /controllers\//);
});

