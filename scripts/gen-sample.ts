import fs from 'node:fs';
import path from 'node:path';
import { scaffoldModule } from '../src/generator/scaffolder.js';
import type { ProjectInfo } from '../src/detector.js';

async function main() {
  const targetDir = path.resolve(process.argv[2] || './sample-output');

  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
  fs.mkdirSync(targetDir, { recursive: true });

  const laravelProject: ProjectInfo = {
    type: 'laravel',
    name: 'sample-laravel',
    rootPath: targetDir,
    summary: 'Laravel 11.0',
    laravel: {
      version: '11.0.0',
      hasFilament: true,
      hasLivewire: false,
      hasInertia: false,
      hasSanctum: true,
      isModular: true,
      modulesDir: 'app/Modules',
    },
  };

  // 1. Scaffold Standard Laravel components
  console.log('Generating standard Laravel components...');
  await scaffoldModule(laravelProject, {
    moduleName: 'StandardUser',
    components: ['model', 'controller', 'service', 'action', 'request', 'migration'],
    isModular: false,
  });

  // 2. Scaffold Modular Laravel components
  console.log('Generating modular Laravel components...');
  await scaffoldModule(laravelProject, {
    moduleName: 'BillingSystem',
    components: ['model', 'controller', 'service', 'action', 'request', 'migration'],
    isModular: true,
  });

  // 3. Scaffold Laravel 10 model
  const laravel10Project: ProjectInfo = {
    ...laravelProject,
    laravel: {
      ...laravelProject.laravel!,
      version: '10.48.0',
    },
  };
  console.log('Generating Laravel 10 components...');
  await scaffoldModule(laravel10Project, {
    moduleName: 'LegacyAccount',
    components: ['model', 'controller'],
    isModular: false,
  });

  console.log(`Successfully generated sample PHP boilerplate files into: ${targetDir}`);
}

main().catch((err) => {
  console.error('Failed to generate sample files:', err);
  process.exit(1);
});
