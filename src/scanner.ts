import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import fg from 'fast-glob';
import type { ProjectInfo } from './detector.js';

export const SAFE_IGNORE_LIST = [
  // Dependencies & package management
  '**/node_modules/**',
  '**/vendor/**',
  '**/.pnpm/**',
  '**/.yarn/**',
  // Version control
  '**/.git/**',
  '**/.svn/**',
  '**/.hg/**',
  // Storage, cache & build outputs (scoped to root to preserve src/build/)
  '**/storage/**',
  '**/dist/**',
  'build/**',
  'out/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/.turbo/**',
  '**/.cache/**',
  '**/coverage/**',
  '**/.temp/**',
  'tmp/**',
  // IDEs & OS files
  '**/.idea/**',
  '**/.vscode/**',
  '**/.DS_Store',
  '**/Thumbs.db',
  // Secrets, private keys & cloud credentials
  '**/.env*',
  '**/*.pem',
  '**/*.key',
  '**/*.pfx',
  '**/*.p12',
  '**/*.jks',
  '**/*.keystore',
  '**/*.cert',
  '**/*.crt',
  '**/*.secret',
  '**/secrets/**',
  '**/.aws/**',
  '**/.ssh/**',
  '**/credentials*.json',
  '**/*service-account*.json',
  '**/id_rsa*',
  '**/id_ed25519*',
  '**/id_ecdsa*',
  '**/*.pub',
  // Logs & Lock files
  '**/*.log',
  '**/*.lock',
  '**/package-lock.json',
  '**/yarn.lock',
  '**/pnpm-lock.yaml',
  '**/composer.lock',
];

export interface ComponentGroup {
  name: string;
  count: number;
  files: string[];
  description: string;
}

export interface ScanResult {
  projectInfo: ProjectInfo;
  totalFilesScanned: number;
  components: Record<string, ComponentGroup>;
  modules: string[];
  directoryTree: string;
  scanDurationMs: number;
}

export function localeIndependentCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Build a clean ASCII directory tree representation from a list of relative file paths.
 */
export function buildCleanDirectoryTree(files: string[], maxDepth: number = 3): string {
  interface TreeNode {
    name: string;
    isDir: boolean;
    children: Map<string, TreeNode>;
  }

  const root: TreeNode = { name: '', isDir: true, children: new Map() };

  // Populate tree
  for (const file of files) {
    const parts = file.split(/[/\\]/);
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          isDir: !isLast,
          children: new Map(),
        });
      }
      current = current.children.get(part)!;
    }
  }

  const lines: string[] = [];

  function renderNode(node: TreeNode, prefix: string, currentDepth: number) {
    if (currentDepth > maxDepth) return;

    const entries = Array.from(node.children.values()).sort((a, b) => {
      // Directories first, then files
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return localeIndependentCompare(a.name, b.name);
    });

    // If at maxDepth and has children, show summary
    if (currentDepth === maxDepth && entries.length > 0) {
      lines.push(`${prefix}└── ... (${entries.length} items hidden)`);
      return;
    }

    // Limit files shown per directory if too many
    const maxEntriesPerDir = 8;
    const displayedEntries = entries.slice(0, maxEntriesPerDir);
    const hiddenCount = entries.length - displayedEntries.length;

    displayedEntries.forEach((child, index) => {
      const isLast = index === displayedEntries.length - 1 && hiddenCount === 0;
      const pointer = isLast ? '└── ' : '├── ';
      const displayName = child.isDir ? `${child.name}/` : child.name;

      lines.push(`${prefix}${pointer}${displayName}`);

      if (child.isDir) {
        const nextPrefix = prefix + (isLast ? '    ' : '│   ');
        renderNode(child, nextPrefix, currentDepth + 1);
      }
    });

    if (hiddenCount > 0) {
      lines.push(`${prefix}└── ... (${hiddenCount} more files/folders)`);
    }
  }

  // Render children of root
  const topLevel = Array.from(root.children.values()).sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return localeIndependentCompare(a.name, b.name);
  });

  topLevel.forEach((child, index) => {
    const isLast = index === topLevel.length - 1;
    const pointer = isLast ? '└── ' : '├── ';
    const displayName = child.isDir ? `${child.name}/` : child.name;

    lines.push(`${pointer}${displayName}`);
    if (child.isDir) {
      const nextPrefix = isLast ? '    ' : '│   ';
      renderNode(child, nextPrefix, 1);
    }
  });

  return lines.join('\n');
}

/**
 * Scan project safely using fast-glob and categorize architectural components.
 */
export async function scanProject(projectInfo: ProjectInfo): Promise<ScanResult> {
  const startTime = Date.now();
  const root = projectInfo.rootPath;

  // Avoid scanning system root drive or home directory directly
  const resolvedRoot = path.resolve(root);
  const parsedRoot = path.parse(resolvedRoot);
  if (parsedRoot.root === resolvedRoot || (typeof os.homedir === 'function' && resolvedRoot === os.homedir())) {
    throw new Error(`Refusing to scan system drive or home directory root directly: "${resolvedRoot}".`);
  }

  // Scan all relevant files in repo while respecting SAFE_IGNORE_LIST
  const allFiles = await fg('**/*', {
    cwd: root,
    ignore: SAFE_IGNORE_LIST,
    dot: false,
    onlyFiles: true,
    followSymbolicLinks: false,
    suppressErrors: true,
  });

  const MAX_FILES_CAP = 10000;
  let normalizedFiles = allFiles.map((f) => f.replace(/\\/g, '/'));
  if (normalizedFiles.length > MAX_FILES_CAP) {
    console.warn(`[WARN] Large codebase detected (${normalizedFiles.length} files). Capping scan analysis to first ${MAX_FILES_CAP} files.`);
    normalizedFiles = normalizedFiles.slice(0, MAX_FILES_CAP);
  }
  const components: Record<string, ComponentGroup> = {};
  const modulesSet = new Set<string>();

  if (projectInfo.type === 'laravel') {
    // 1. Models - match Models/ anywhere under app or modules dirs, exclude non-model files
    const models = normalizedFiles.filter((f) =>
      /^(?:app|modules|Modules)\/(?:.*\/)?Models\/.*\.php$/i.test(f)
    );
    components['Models'] = {
      name: 'Eloquent Models',
      count: models.length,
      files: models,
      description: 'Database entity mappings and business logic models',
    };

    // 2. Controllers
    const controllers = normalizedFiles.filter((f) =>
      /^(?:app|modules|Modules)\/(?:.*\/)?Controllers\/.*\.php$/i.test(f)
    );
    components['Controllers'] = {
      name: 'HTTP Controllers',
      count: controllers.length,
      files: controllers,
      description: 'Request handling and response orchestration',
    };

    // 3. Services
    const services = normalizedFiles.filter((f) =>
      /^(?:app|modules|Modules)\/(?:.*\/)?Services\/.*\.php$/i.test(f)
    );
    components['Services'] = {
      name: 'Service Classes',
      count: services.length,
      files: services,
      description: 'Encapsulated business logic and external integrations',
    };

    // 4. Actions
    const actions = normalizedFiles.filter((f) =>
      /^(?:app|modules|Modules)\/(?:.*\/)?Actions\/.*\.php$/i.test(f)
    );
    components['Actions'] = {
      name: 'Action Classes',
      count: actions.length,
      files: actions,
      description: 'Single-responsibility invokable operations',
    };

    // 5. Form Requests
    const requests = normalizedFiles.filter((f) =>
      /^(?:app|modules|Modules)\/(?:.*\/)?(?:Http\/)?Requests\/.*\.php$/i.test(f)
    );
    components['Form Requests'] = {
      name: 'Form Requests',
      count: requests.length,
      files: requests,
      description: 'Input validation and authorization rules',
    };

    // 6. Filament Resources
    const filament = normalizedFiles.filter((f) =>
      /^(?:app|modules|Modules)\/(?:.*\/)?Filament\/.*\.php$/i.test(f)
    );
    if (filament.length > 0 || projectInfo.laravel?.hasFilament) {
      components['Filament Resources'] = {
        name: 'Filament Admin Resources',
        count: filament.length,
        files: filament,
        description: 'Admin panel CRUD pages, widgets, and schemas',
      };
    }

    // 7. Routes
    const routes = normalizedFiles.filter((f) =>
      /^(?:routes\/.*\.php|(?:app\/Modules|modules|Modules)\/.*\/routes?.*\.php)$/i.test(f)
    );
    components['Routes'] = {
      name: 'Routing Definitions',
      count: routes.length,
      files: routes,
      description: 'Web, API, and console endpoint routes',
    };

    // 8. Database Migrations
    const migrations = normalizedFiles.filter((f) =>
      /(?:^database\/migrations\/.*\.php$|\/migrations\/.*\.php$)/i.test(f)
    );
    components['Migrations'] = {
      name: 'Database Migrations',
      count: migrations.length,
      files: migrations,
      description: 'Schema version control and table definitions',
    };

    // Detect Laravel Modules - must require a trailing slash after module name so loose files are excluded
    const modDirPattern = projectInfo.laravel?.modulesDir
      ? `(?:${projectInfo.laravel.modulesDir}|app/Modules|modules|Modules)`
      : '(?:app/Modules|modules|Modules)';
    const modRegex = new RegExp(`^${modDirPattern}/([^/]+)/`, 'i');

    for (const f of normalizedFiles) {
      const match = f.match(modRegex);
      if (match && match[1]) {
        modulesSet.add(match[1]);
      }
    }
  } else if (projectInfo.type === 'typescript') {
    const srcDir = projectInfo.typescript?.srcDir ?? 'src';
    // Support custom srcDir as well as monorepo packages (apps/*/src, packages/*/src)
    const tsPrefix = `(?:${srcDir}|(?:apps|packages)/[^/]+/(?:${srcDir}|src))`;

    // 1. Controllers (files in controllers/ or matching .controller.(ts|js))
    const controllers = normalizedFiles.filter((f) =>
      !f.endsWith('.d.ts') &&
      new RegExp(`^${tsPrefix}/(?:.*/)?(?:controllers/.*\\.(?:ts|js|mts|cts)|.*[./]controller\\.(?:ts|js|mts|cts))$`, 'i').test(f)
    );
    components['Controllers'] = {
      name: 'Controllers',
      count: controllers.length,
      files: controllers,
      description: 'HTTP request handlers and response dispatchers',
    };

    // 2. Services (files in services/ or matching .service.(ts|js))
    const services = normalizedFiles.filter((f) =>
      !f.endsWith('.d.ts') &&
      new RegExp(`^${tsPrefix}/(?:.*/)?(?:services/.*\\.(?:ts|js|mts|cts)|.*[./]service\\.(?:ts|js|mts|cts))$`, 'i').test(f)
    );
    components['Services'] = {
      name: 'Services',
      count: services.length,
      files: services,
      description: 'Core domain logic and application workflows',
    };

    // 3. Repositories (files in repositories/ or matching .repository.(ts|js))
    const repositories = normalizedFiles.filter((f) =>
      !f.endsWith('.d.ts') &&
      new RegExp(`^${tsPrefix}/(?:.*/)?(?:repositories/.*\\.(?:ts|js|mts|cts)|.*[./]repository\\.(?:ts|js|mts|cts))$`, 'i').test(f)
    );
    components['Repositories'] = {
      name: 'Repositories',
      count: repositories.length,
      files: repositories,
      description: 'Data access abstraction and database queries',
    };

    // 4. Routes (files in routes/ or matching .routes.(ts|js))
    const routes = normalizedFiles.filter((f) =>
      !f.endsWith('.d.ts') &&
      new RegExp(`^${tsPrefix}/(?:.*/)?(?:routes/.*\\.(?:ts|js|mts|cts)|.*[./]routes?\\.(?:ts|js|mts|cts))$`, 'i').test(f)
    );
    components['Routes'] = {
      name: 'Routes',
      count: routes.length,
      files: routes,
      description: 'API endpoint mappings and router handlers',
    };

    // 5. DTOs & Validation Schemas
    const dtos = normalizedFiles.filter((f) =>
      !f.endsWith('.d.ts') &&
      new RegExp(`^${tsPrefix}/(?:.*/)?(?:(?:dtos|schemas)/.*\\.(?:ts|js|mts|cts)|.*[./](?:dto|schema)\\.(?:ts|js|mts|cts))$`, 'i').test(f)
    );
    components['DTOs & Schemas'] = {
      name: 'DTOs & Schemas',
      count: dtos.length,
      files: dtos,
      description: 'Data transfer objects and request validation schemas',
    };

    // 6. Models / Prisma / Entities
    const models = normalizedFiles.filter((f) =>
      !f.endsWith('.d.ts') &&
      (new RegExp(`^${tsPrefix}/(?:.*/)?(?:(?:models|entities)/.*\\.(?:ts|js|mts|cts)|.*[./](?:model|entity)\\.(?:ts|js|mts|cts))$`, 'i').test(f) ||
        /(?:^|\/)prisma\/schema\.prisma$/i.test(f))
    );
    components['Models & Entities'] = {
      name: 'Models & Entities',
      count: models.length,
      files: models,
      description: 'Database schema definitions and entity declarations',
    };

    // 7. Frontend Components (if React/Vue/Next/Vite)
    const componentsFiles = normalizedFiles.filter((f) =>
      new RegExp(`^${tsPrefix}/(?:components|ui)/.*\\.(?:tsx|jsx|vue|svelte|ts|js)$`, 'i').test(f)
    );
    if (componentsFiles.length > 0) {
      components['UI Components'] = {
        name: 'UI Components',
        count: componentsFiles.length,
        files: componentsFiles,
        description: 'Reusable user interface views and components',
      };
    }

    // Detect TypeScript Modules (requiring trailing slash after module name)
    const moduleRegex = new RegExp(`^(?:${tsPrefix}/modules|modules)/([^/]+)/`, 'i');
    for (const mf of normalizedFiles) {
      const match = mf.match(moduleRegex);
      if (match && match[1]) {
        modulesSet.add(match[1]);
      }
    }

    // If no classic web layers are found (e.g. CLI tool, utility library), populate Source and Test files
    const totalWebLayers = Object.values(components).reduce((acc, c) => acc + c.count, 0);
    if (totalWebLayers === 0) {
      const srcFiles = normalizedFiles.filter((f) =>
        new RegExp(`^${tsPrefix}/`, 'i').test(f)
      );
      const testFiles = normalizedFiles.filter((f) =>
        /(?:^|[._-])(?:test|spec)\.[a-z]+$|(?:^|\/)__tests__\//i.test(f)
      );

      components['Source Files'] = {
        name: 'Source Files',
        count: srcFiles.length,
        files: srcFiles,
        description: 'Main application source code',
      };

      components['Test Files'] = {
        name: 'Test Files',
        count: testFiles.length,
        files: testFiles,
        description: 'Automated test suites and specifications',
      };
    }
  } else {
    // Generic project component classification
    const srcFiles = normalizedFiles.filter((f) => /^src\//i.test(f));
    const testFiles = normalizedFiles.filter((f) =>
      /(?:^|[._-])(?:test|spec)\.[a-z]+$|(?:^|\/)__tests__\//i.test(f)
    );

    components['Source Files'] = {
      name: 'Source Files',
      count: srcFiles.length,
      files: srcFiles,
      description: 'Main application source code',
    };

    components['Test Files'] = {
      name: 'Test Files',
      count: testFiles.length,
      files: testFiles,
      description: 'Automated test suites and specifications',
    };
  }

  // Generate clean directory tree
  const directoryTree = buildCleanDirectoryTree(normalizedFiles, 3);
  const scanDurationMs = Date.now() - startTime;

  return {
    projectInfo,
    totalFilesScanned: normalizedFiles.length,
    components,
    modules: Array.from(modulesSet).sort(localeIndependentCompare),
    directoryTree,
    scanDurationMs,
  };
}
