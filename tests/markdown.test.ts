import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMermaidDiagram, generateArchitectureMarkdown } from '../src/generator/markdown.ts';
import type { ScanResult } from '../src/scanner.ts';

test('generateMermaidDiagram creates valid Laravel flowchart with Filament and Modules', () => {
  const scanResult: ScanResult = {
    projectInfo: {
      type: 'laravel',
      name: 'shop-laravel',
      rootPath: '/dummy',
      summary: 'Laravel 11.0 (Filament)',
      laravel: {
        hasFilament: true,
        hasLivewire: false,
        hasInertia: false,
        hasSanctum: true,
        isModular: true,
      },
    },
    totalFilesScanned: 50,
    components: {
      Models: { name: 'Models', count: 5, files: ['app/Models/User.php'], description: 'Models' },
      Controllers: { name: 'Controllers', count: 3, files: ['app/Http/Controllers/UserController.php'], description: 'Controllers' },
      Services: { name: 'Services', count: 2, files: ['app/Services/UserService.php'], description: 'Services' },
      Actions: { name: 'Actions', count: 2, files: ['app/Actions/CreateUserAction.php'], description: 'Actions' },
      'Filament Resources': { name: 'Filament', count: 2, files: ['app/Filament/Resources/UserResource.php'], description: 'Admin' },
    },
    modules: ['Catalog', 'Checkout'],
    directoryTree: 'app/\n├── Models/\n└── Http/',
    scanDurationMs: 25,
  };

  const mermaid = generateMermaidDiagram(scanResult);

  assert.match(mermaid, /^flowchart TD/);
  assert.match(mermaid, /subgraph Layer1/);
  assert.match(mermaid, /Filament Admin Panel/);
  assert.match(mermaid, /Actions\["Action Classes/);
  assert.match(mermaid, /subgraph ModulesLayer/);
  assert.match(mermaid, /Catalog Module/);
  assert.match(mermaid, /Checkout Module/);
});

test('generateArchitectureMarkdown generates complete markdown with security notice', () => {
  const scanResult: ScanResult = {
    projectInfo: {
      type: 'typescript',
      name: 'fintech-api',
      rootPath: '/dummy',
      summary: 'TypeScript (express, Prisma)',
      typescript: {
        framework: 'express',
        hasPrisma: true,
        hasTypeORM: false,
        hasDrizzle: false,
        isMonorepo: false,
        isModular: true,
        srcDir: 'src',
      },
    },
    totalFilesScanned: 35,
    components: {
      Controllers: { name: 'Controllers', count: 4, files: ['src/modules/payment/payment.controller.ts'], description: 'Controllers' },
      Services: { name: 'Services', count: 4, files: ['src/modules/payment/payment.service.ts'], description: 'Services' },
      Repositories: { name: 'Repositories', count: 4, files: ['src/modules/payment/payment.repository.ts'], description: 'Repositories' },
    },
    modules: ['payment', 'auth'],
    directoryTree: 'src/\n└── modules/',
    scanDurationMs: 15,
  };

  const md = generateArchitectureMarkdown(scanResult);

  assert.match(md, /# 🏛️ Architecture Overview: fintech-api/);
  assert.match(md, /## 📌 Project Summary/);
  assert.match(md, /## 📊 Architectural Components Statistics/);
  assert.match(md, /## 📦 Detected Modules & Domains \(2\)/);
  assert.match(md, /## 🗺️ Visual Architecture Flowchart/);
  assert.match(md, /```mermaid[\s\S]+```/);
  assert.match(md, /## 🌲 Directory Structure Tree/);
  assert.match(md, /## 🔒 Security & Privacy Notice/);
  assert.match(md, /Zero Network Transmission/);
  assert.match(md, /Safe Exclusion Filter/);
  assert.match(md, /Metadata Only/);
});
