import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { scaffoldModule } from '../src/generator/scaffolder.js';
import type { ProjectInfo } from '../src/detector.js';

test('scaffolds Laravel standard components with correct boilerplate', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'larats-scaffold-laravel-'));

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
        hasSanctum: true,
        isModular: false,
      },
    };

    const result = await scaffoldModule(projectInfo, {
      moduleName: 'Subscription',
      components: ['model', 'controller', 'service', 'request', 'migration'],
      isModular: false,
    });

    assert.equal(result.createdCount, 5);
    assert.equal(result.skippedCount, 0);
    assert.equal(result.errorCount, 0);

    // Verify Model
    const modelPath = path.join(tempDir, 'app', 'Models', 'Subscription.php');
    assert.equal(fs.existsSync(modelPath), true);
    const modelContent = fs.readFileSync(modelPath, 'utf-8');
    assert.match(modelContent, /class Subscription extends Model/);
    assert.match(modelContent, /\$table = 'subscriptions'/);

    // Verify Controller
    const controllerPath = path.join(tempDir, 'app', 'Http', 'Controllers', 'SubscriptionController.php');
    assert.equal(fs.existsSync(controllerPath), true);
    const controllerContent = fs.readFileSync(controllerPath, 'utf-8');
    assert.match(controllerContent, /class SubscriptionController extends Controller/);
    assert.match(controllerContent, /use App\\Services\\SubscriptionService;/);

    // Verify Service
    const servicePath = path.join(tempDir, 'app', 'Services', 'SubscriptionService.php');
    assert.equal(fs.existsSync(servicePath), true);

    // Verify Request
    const requestPath = path.join(tempDir, 'app', 'Http', 'Requests', 'SubscriptionRequest.php');
    assert.equal(fs.existsSync(requestPath), true);

    // Verify Migration
    const migrationsDir = path.join(tempDir, 'database', 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir);
    assert.equal(migrationFiles.length, 1);
    assert.match(migrationFiles[0], /create_subscriptions_table\.php/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('scaffolds Laravel modular components under app/Modules/<Name>', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'larats-scaffold-laravel-mod-'));

  try {
    const projectInfo: ProjectInfo = {
      type: 'laravel',
      name: 'test-laravel-mod',
      rootPath: tempDir,
      summary: 'Laravel (Modular)',
      laravel: {
        hasFilament: false,
        hasLivewire: false,
        hasInertia: false,
        hasSanctum: false,
        isModular: true,
      },
    };

    const result = await scaffoldModule(projectInfo, {
      moduleName: 'Invoice',
      components: ['model', 'controller', 'service', 'action'],
      isModular: true,
    });

    assert.equal(result.createdCount, 4);

    const modelPath = path.join(tempDir, 'app', 'Modules', 'Invoice', 'Models', 'Invoice.php');
    assert.equal(fs.existsSync(modelPath), true);
    assert.match(fs.readFileSync(modelPath, 'utf-8'), /namespace App\\Modules\\Invoice\\Models;/);

    const controllerPath = path.join(tempDir, 'app', 'Modules', 'Invoice', 'Controllers', 'InvoiceController.php');
    assert.equal(fs.existsSync(controllerPath), true);
    assert.match(fs.readFileSync(controllerPath, 'utf-8'), /namespace App\\Modules\\Invoice\\Controllers;/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('scaffolds TypeScript modular components under src/modules/<name>', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'larats-scaffold-ts-'));

  try {
    const projectInfo: ProjectInfo = {
      type: 'typescript',
      name: 'test-ts-api',
      rootPath: tempDir,
      summary: 'TypeScript (express)',
      typescript: {
        framework: 'express',
        hasPrisma: false,
        hasTypeORM: false,
        hasDrizzle: false,
        isMonorepo: false,
        isModular: true,
        srcDir: 'src',
      },
    };

    const result = await scaffoldModule(projectInfo, {
      moduleName: 'PaymentGateway',
      components: ['controller', 'service', 'repository', 'route', 'dto'],
      isModular: true,
    });

    // 5 components + 1 index.ts barrel export = 6 files
    assert.equal(result.createdCount, 6);

    const moduleDir = path.join(tempDir, 'src', 'modules', 'payment-gateway');
    assert.equal(fs.existsSync(path.join(moduleDir, 'payment-gateway.controller.ts')), true);
    assert.equal(fs.existsSync(path.join(moduleDir, 'payment-gateway.service.ts')), true);
    assert.equal(fs.existsSync(path.join(moduleDir, 'payment-gateway.repository.ts')), true);
    assert.equal(fs.existsSync(path.join(moduleDir, 'payment-gateway.routes.ts')), true);
    assert.equal(fs.existsSync(path.join(moduleDir, 'payment-gateway.dto.ts')), true);
    assert.equal(fs.existsSync(path.join(moduleDir, 'index.ts')), true);

    const controllerContent = fs.readFileSync(path.join(moduleDir, 'payment-gateway.controller.ts'), 'utf-8');
    assert.match(controllerContent, /class PaymentGatewayController/);
    assert.match(controllerContent, /PaymentGatewayService/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('ANTI-OVERWRITE PROTECTION: existing files are safely preserved and skipped', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'larats-anti-overwrite-'));

  try {
    const projectInfo: ProjectInfo = {
      type: 'typescript',
      name: 'test-protection',
      rootPath: tempDir,
      summary: 'TypeScript',
      typescript: {
        framework: 'express',
        hasPrisma: false,
        hasTypeORM: false,
        hasDrizzle: false,
        isMonorepo: false,
        isModular: true,
        srcDir: 'src',
      },
    };

    const controllerPath = path.join(tempDir, 'src', 'modules', 'auth', 'auth.controller.ts');
    fs.mkdirSync(path.dirname(controllerPath), { recursive: true });
    const originalContent = '// IMPORTANT CUSTOM BUSINESS LOGIC THAT MUST NOT BE OVERWRITTEN';
    fs.writeFileSync(controllerPath, originalContent, 'utf-8');

    // Run scaffolder on same module and component without force
    const result = await scaffoldModule(projectInfo, {
      moduleName: 'auth',
      components: ['controller'],
      isModular: true,
      forceOverwrite: false,
    });

    assert.equal(result.skippedCount, 1);
    assert.equal(result.createdCount, 0);

    // Verify content was NOT touched
    const currentContent = fs.readFileSync(controllerPath, 'utf-8');
    assert.equal(currentContent, originalContent);

    // Now test with forceOverwrite: true
    const forceResult = await scaffoldModule(projectInfo, {
      moduleName: 'auth',
      components: ['controller'],
      isModular: true,
      forceOverwrite: true,
    });

    assert.equal(forceResult.createdCount, 1);
    assert.equal(forceResult.skippedCount, 0);
    const updatedContent = fs.readFileSync(controllerPath, 'utf-8');
    assert.notEqual(updatedContent, originalContent);
    assert.match(updatedContent, /AuthController/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

