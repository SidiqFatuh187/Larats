import fs from 'node:fs';
import path from 'node:path';
import type { ProjectInfo } from '../detector.js';
import {
  getNaming,
  laravelModelTemplate,
  laravelControllerTemplate,
  laravelServiceTemplate,
  laravelActionTemplate,
  laravelRequestTemplate,
  laravelMigrationTemplate,
} from '../templates/laravel.js';
import {
  tsControllerTemplate,
  tsServiceTemplate,
  tsRepositoryTemplate,
  tsRoutesTemplate,
  tsDtoTemplate,
} from '../templates/typescript.js';

export interface ScaffoldOptions {
  moduleName: string;
  components: string[];
  isModular?: boolean;
  dryRun?: boolean;
  forceOverwrite?: boolean;
}

export interface ScaffoldFileResult {
  filePath: string;
  relativeFilePath: string;
  status: 'created' | 'skipped' | 'error';
  reason?: string;
}

export interface ScaffoldResult {
  moduleName: string;
  targetDir: string;
  files: ScaffoldFileResult[];
  createdCount: number;
  skippedCount: number;
  errorCount: number;
  dryRun?: boolean;
}

const RESERVED_NAMES = new Set([
  'model',
  'controller',
  'service',
  'action',
  'request',
  'migration',
  'repository',
  'route',
  'dto',
  'object',
  'class',
  'interface',
  'module',
  'app',
  'base',
]);

/**
 * Validate a user-provided module or feature name.
 * Returns an error string if invalid, or null if valid.
 */
export function validateModuleName(name: string): string | null {
  if (!name || !name.trim()) {
    return 'Module name cannot be empty.';
  }
  const trimmed = name.trim();
  if (!/^[a-zA-Z]/.test(trimmed)) {
    return 'Module name must start with an alphabetical letter.';
  }
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(trimmed)) {
    return 'Module name may only contain alphanumeric characters, hyphens, and underscores.';
  }
  if (RESERVED_NAMES.has(trimmed.toLowerCase())) {
    return `"${trimmed}" is a reserved framework name and cannot be used as a module name.`;
  }
  return null;
}

/**
 * Format timestamp for Laravel migration file name (e.g. 2026_10_24_114000)
 */
function getMigrationTimestamp(): string {
  const now = new Date();
  const YYYY = now.getFullYear();
  const MM = String(now.getMonth() + 1).padStart(2, '0');
  const DD = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${YYYY}_${MM}_${DD}_${hh}${mm}${ss}`;
}

/**
 * Scaffold components for Laravel or TypeScript projects safely without overwriting existing code.
 */
export async function scaffoldModule(
  projectInfo: ProjectInfo,
  options: ScaffoldOptions
): Promise<ScaffoldResult> {
  const root = projectInfo.rootPath;
  const names = getNaming(options.moduleName);
  const filesToGenerate: {
    relativePath: string;
    content: string;
    isBarrel?: boolean;
    barrelExports?: string[];
  }[] = [];
  const results: ScaffoldFileResult[] = [];
  let createdCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  const isModular =
    options.isModular ??
    (projectInfo.type === 'laravel'
      ? Boolean(projectInfo.laravel?.isModular)
      : projectInfo.type === 'typescript'
        ? Boolean(projectInfo.typescript?.isModular)
        : true);

  if (projectInfo.type === 'laravel') {
    const selected = new Set(options.components);

    const addMigrationIfRequested = () => {
      const migrationsDir = path.join(root, 'database', 'migrations');
      let existingMigration: string | null = null;
      if (fs.existsSync(migrationsDir)) {
        const files = fs.readdirSync(migrationsDir);
        const match = files.find((f) => f.endsWith(`_create_${names.pluralSnake}_table.php`));
        if (match) {
          existingMigration = match;
        }
      }

      if (existingMigration && !options.forceOverwrite) {
        results.push({
          filePath: path.join(migrationsDir, existingMigration),
          relativeFilePath: `database/migrations/${existingMigration}`,
          status: 'skipped',
          reason: 'Migration for table already exists (overwrite protected)',
        });
        skippedCount++;
      } else {
        const timestamp = existingMigration ? existingMigration.split('_create_')[0] : getMigrationTimestamp();
        filesToGenerate.push({
          relativePath: `database/migrations/${timestamp}_create_${names.pluralSnake}_table.php`,
          content: laravelMigrationTemplate(names),
        });
      }
    };

    if (isModular) {
      const baseDir = `app/Modules/${names.pascal}`;
      const baseNamespace = `App\\Modules\\${names.pascal}`;

      if (selected.has('model')) {
        filesToGenerate.push({
          relativePath: `${baseDir}/Models/${names.pascal}.php`,
          content: laravelModelTemplate(names, `${baseNamespace}\\Models`, projectInfo.laravel?.version),
        });
      }
      if (selected.has('controller')) {
        filesToGenerate.push({
          relativePath: `${baseDir}/Controllers/${names.pascal}Controller.php`,
          content: laravelControllerTemplate(names, {
            namespace: `${baseNamespace}\\Controllers`,
            modelNamespace: `${baseNamespace}\\Models`,
            serviceNamespace: `${baseNamespace}\\Services`,
            requestNamespace: `${baseNamespace}\\Requests`,
          }),
        });
      }
      if (selected.has('service')) {
        filesToGenerate.push({
          relativePath: `${baseDir}/Services/${names.pascal}Service.php`,
          content: laravelServiceTemplate(names, {
            namespace: `${baseNamespace}\\Services`,
            modelNamespace: `${baseNamespace}\\Models`,
          }),
        });
      }
      if (selected.has('action')) {
        filesToGenerate.push({
          relativePath: `${baseDir}/Actions/Create${names.pascal}Action.php`,
          content: laravelActionTemplate(names, {
            namespace: `${baseNamespace}\\Actions`,
            modelNamespace: `${baseNamespace}\\Models`,
          }),
        });
      }
      if (selected.has('request')) {
        filesToGenerate.push({
          relativePath: `${baseDir}/Requests/${names.pascal}Request.php`,
          content: laravelRequestTemplate(names, `${baseNamespace}\\Requests`),
        });
      }
      if (selected.has('migration')) {
        addMigrationIfRequested();
      }
    } else {
      // Standard Laravel Structure
      if (selected.has('model')) {
        filesToGenerate.push({
          relativePath: `app/Models/${names.pascal}.php`,
          content: laravelModelTemplate(names, 'App\\Models', projectInfo.laravel?.version),
        });
      }
      if (selected.has('controller')) {
        filesToGenerate.push({
          relativePath: `app/Http/Controllers/${names.pascal}Controller.php`,
          content: laravelControllerTemplate(names),
        });
      }
      if (selected.has('service')) {
        filesToGenerate.push({
          relativePath: `app/Services/${names.pascal}Service.php`,
          content: laravelServiceTemplate(names),
        });
      }
      if (selected.has('action')) {
        filesToGenerate.push({
          relativePath: `app/Actions/Create${names.pascal}Action.php`,
          content: laravelActionTemplate(names),
        });
      }
      if (selected.has('request')) {
        filesToGenerate.push({
          relativePath: `app/Http/Requests/${names.pascal}Request.php`,
          content: laravelRequestTemplate(names),
        });
      }
      if (selected.has('migration')) {
        addMigrationIfRequested();
      }
    }
  } else {
    // TypeScript (or fallback)
    const selected = new Set(options.components);
    const srcDir = projectInfo.typescript?.srcDir || 'src';

    if (isModular) {
      const moduleFolder = `${srcDir}/modules/${names.kebab}`;

      if (selected.has('controller')) {
        filesToGenerate.push({
          relativePath: `${moduleFolder}/${names.kebab}.controller.ts`,
          content: tsControllerTemplate(names, true),
        });
      }
      if (selected.has('service')) {
        filesToGenerate.push({
          relativePath: `${moduleFolder}/${names.kebab}.service.ts`,
          content: tsServiceTemplate(names, true),
        });
      }
      if (selected.has('repository')) {
        filesToGenerate.push({
          relativePath: `${moduleFolder}/${names.kebab}.repository.ts`,
          content: tsRepositoryTemplate(names, true),
        });
      }
      if (selected.has('route')) {
        filesToGenerate.push({
          relativePath: `${moduleFolder}/${names.kebab}.routes.ts`,
          content: tsRoutesTemplate(names, true),
        });
      }
      if (selected.has('dto')) {
        filesToGenerate.push({
          relativePath: `${moduleFolder}/${names.kebab}.dto.ts`,
          content: tsDtoTemplate(names),
        });
      }

      // Add barrel index.ts export if multiple components generated in module
      if (filesToGenerate.length > 1) {
        const exports: string[] = [];
        if (selected.has('controller')) exports.push(`export * from './${names.kebab}.controller.js';`);
        if (selected.has('service')) exports.push(`export * from './${names.kebab}.service.js';`);
        if (selected.has('repository')) exports.push(`export * from './${names.kebab}.repository.js';`);
        if (selected.has('route')) exports.push(`export * from './${names.kebab}.routes.js';`);
        if (selected.has('dto')) exports.push(`export * from './${names.kebab}.dto.js';`);

        if (exports.length > 0) {
          filesToGenerate.push({
            relativePath: `${moduleFolder}/index.ts`,
            content: `${exports.join('\n')}\n`,
            isBarrel: true,
            barrelExports: exports,
          });
        }
      }
    } else {
      // Layered structure
      if (selected.has('controller')) {
        filesToGenerate.push({
          relativePath: `${srcDir}/controllers/${names.kebab}.controller.ts`,
          content: tsControllerTemplate(names, false),
        });
      }
      if (selected.has('service')) {
        filesToGenerate.push({
          relativePath: `${srcDir}/services/${names.kebab}.service.ts`,
          content: tsServiceTemplate(names, false),
        });
      }
      if (selected.has('repository')) {
        filesToGenerate.push({
          relativePath: `${srcDir}/repositories/${names.kebab}.repository.ts`,
          content: tsRepositoryTemplate(names, false),
        });
      }
      if (selected.has('route')) {
        filesToGenerate.push({
          relativePath: `${srcDir}/routes/${names.kebab}.routes.ts`,
          content: tsRoutesTemplate(names, false),
        });
      }
      if (selected.has('dto')) {
        filesToGenerate.push({
          relativePath: `${srcDir}/dtos/${names.kebab}.dto.ts`,
          content: tsDtoTemplate(names),
        });
      }
    }
  }

  // Execute file writing with strict Anti-Overwrite Protection

  for (const item of filesToGenerate) {
    const fullPath = path.resolve(root, item.relativePath);

    // Defense in depth: path traversal check
    const rel = path.relative(root, fullPath);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      results.push({
        filePath: fullPath,
        relativeFilePath: item.relativePath,
        status: 'error',
        reason: 'Path traversal attempt detected outside project root',
      });
      errorCount++;
      continue;
    }

    if (options.dryRun) {
      results.push({
        filePath: fullPath,
        relativeFilePath: item.relativePath,
        status: 'created',
        reason: 'Dry run simulated',
      });
      createdCount++;
      continue;
    }

    // Handle TS barrel index.ts appending if file already exists
    if (item.isBarrel && item.barrelExports && fs.existsSync(fullPath)) {
      try {
        const existingContent = fs.readFileSync(fullPath, 'utf-8');
        const missingExports = item.barrelExports.filter(
          (line) => !existingContent.includes(line)
        );

        if (missingExports.length > 0) {
          const newContent = existingContent.endsWith('\n')
            ? existingContent + missingExports.join('\n') + '\n'
            : existingContent + '\n' + missingExports.join('\n') + '\n';
          fs.writeFileSync(fullPath, newContent, 'utf-8');
          results.push({
            filePath: fullPath,
            relativeFilePath: item.relativePath,
            status: 'created',
            reason: 'Appended exports to existing barrel index',
          });
          createdCount++;
        } else {
          results.push({
            filePath: fullPath,
            relativeFilePath: item.relativePath,
            status: 'skipped',
            reason: 'File already exists and contains all module exports',
          });
          skippedCount++;
        }
        continue;
      } catch (err: any) {
        results.push({
          filePath: fullPath,
          relativeFilePath: item.relativePath,
          status: 'error',
          reason: err.message || String(err),
        });
        errorCount++;
        continue;
      }
    }

    try {
      // Ensure directory exists
      const parentDir = path.dirname(fullPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      fs.writeFileSync(fullPath, item.content, {
        flag: options.forceOverwrite ? 'w' : 'wx',
        encoding: 'utf-8',
      });
      results.push({
        filePath: fullPath,
        relativeFilePath: item.relativePath,
        status: 'created',
      });
      createdCount++;
    } catch (err: any) {
      if (err.code === 'EEXIST') {
        results.push({
          filePath: fullPath,
          relativeFilePath: item.relativePath,
          status: 'skipped',
          reason: 'File already exists (overwrite protected)',
        });
        skippedCount++;
      } else {
        results.push({
          filePath: fullPath,
          relativeFilePath: item.relativePath,
          status: 'error',
          reason: err.message || String(err),
        });
        errorCount++;
      }
    }
  }

  return {
    moduleName: names.pascal,
    targetDir: root,
    files: results,
    createdCount,
    skippedCount,
    errorCount,
    dryRun: Boolean(options.dryRun),
  };
}

