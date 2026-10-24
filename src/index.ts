import fs from 'node:fs';
import path from 'node:path';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { detectProjectType, type ProjectInfo } from './detector.js';
import { scanProject } from './scanner.js';
import { generateArchitectureMarkdown } from './generator/markdown.js';
import { scaffoldModule, type ScaffoldResult } from './generator/scaffolder.js';

const VERSION = '1.0.0';

function showHelp() {
  console.log(`
${pc.bold(pc.cyan('ArchMind CLI'))} ${pc.gray(`v${VERSION}`)}
${pc.gray('Smart Architecture Scanner & Contextual Module Scaffolder')}

${pc.bold('USAGE:')}
  ${pc.cyan('$')} npx archmind [command] [options]
  ${pc.cyan('$')} archmind [command] [options]

${pc.bold('COMMANDS:')}
  ${pc.green('scan')}                 Scan repository & generate ARCHITECTURE.md
  ${pc.green('scaffold')}, ${pc.green('make')} [name] Scaffold a new module or feature with clean boilerplate
  ${pc.green('info')}                 Show detected project type & architectural flavor
  ${pc.green('help')}                 Display this help message

${pc.bold('OPTIONS:')}
  ${pc.yellow('-o, --output')} <file>    Output markdown path for scan (default: ARCHITECTURE.md)
  ${pc.yellow('-m, --modular')}          Enforce modular directory structure
  ${pc.yellow('-s, --standard')}         Enforce standard/layered directory structure
  ${pc.yellow('--dry-run')}              Simulate generation without writing files
  ${pc.yellow('-f, --force')}            Overwrite files if they already exist
  ${pc.yellow('-v, --version')}          Display CLI version
  ${pc.yellow('-h, --help')}             Display this help message

${pc.bold('EXAMPLES:')}
  ${pc.cyan('$')} archmind
  ${pc.cyan('$')} archmind scan
  ${pc.cyan('$')} archmind scan --output docs/ARCHITECTURE.md
  ${pc.cyan('$')} archmind scaffold Payment
  ${pc.cyan('$')} archmind make Order --modular
`);
}

/**
 * Handle cancellation gracefully
 */
function handleCancel(): never {
  p.cancel(pc.yellow('Operation cancelled. See you next time! 👋'));
  process.exit(0);
}

/**
 * Execute scan workflow
 */
async function runScan(projectInfo: ProjectInfo, outputPath: string = 'ARCHITECTURE.md') {
  const spinner = p.spinner();
  spinner.start('Scanning codebase structure & components (strict ignore list active)...');

  try {
    const scanResult = await scanProject(projectInfo);
    spinner.stop(pc.green(`Scan completed in ${scanResult.scanDurationMs}ms`));

    const markdown = generateArchitectureMarkdown(scanResult);
    const destination = path.resolve(projectInfo.rootPath, outputPath);

    // Ensure output directory exists if custom path
    const parentDir = path.dirname(destination);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    fs.writeFileSync(destination, markdown, 'utf-8');

    // Display summary
    p.note(
      `${pc.bold('Scanned Files:')} ${scanResult.totalFilesScanned}\n` +
      `${pc.bold('Components Identified:')} ${Object.keys(scanResult.components).length}\n` +
      `${pc.bold('Modules Detected:')} ${scanResult.modules.length > 0 ? scanResult.modules.join(', ') : 'None (monolithic structure)'}\n` +
      `${pc.bold('Documentation:')} Saved to ${pc.cyan(path.relative(projectInfo.rootPath, destination) || outputPath)}`,
      pc.green('Architecture Map Generated! 🗺️')
    );

    p.outro(pc.cyan(`Open ${outputPath} to view your project structure & Mermaid diagram!`));
  } catch (err: any) {
    spinner.stop(pc.red('Scan failed'));
    p.log.error(err.message || String(err));
  }
}

/**
 * Execute scaffold workflow
 */
async function runScaffold(
  projectInfo: ProjectInfo,
  moduleNameArg?: string,
  cliOptions: { modular?: boolean; standard?: boolean; force?: boolean; dryRun?: boolean } = {}
) {
  let moduleName = moduleNameArg;

  if (!moduleName) {
    const input = await p.text({
      message: 'What is the name of the new module or feature?',
      placeholder: 'e.g. Payment, Order, UserProfile',
      validate(val) {
        if (!val || !val.trim()) return 'Module name cannot be empty.';
        if (!/^[a-zA-Z0-9_-]+$/.test(val.trim())) return 'Use only alphanumeric characters, dashes, or underscores.';
      },
    });

    if (p.isCancel(input)) handleCancel();
    moduleName = input.trim();
  }

  // Component selection based on project type
  let selectedComponents: string[] = [];

  if (projectInfo.type === 'laravel') {
    const componentsPrompt = await p.multiselect({
      message: `Select components to scaffold for ${pc.cyan(moduleName)}:`,
      options: [
        { value: 'model', label: 'Eloquent Model', hint: 'Includes table name, fillables, and casts' },
        { value: 'controller', label: 'Resourceful Controller', hint: 'Includes standard CRUD methods & DI service' },
        { value: 'service', label: 'Service Class', hint: 'Encapsulated business logic operations' },
        { value: 'action', label: 'Single Action Class', hint: 'Invokable single-responsibility class' },
        { value: 'request', label: 'Form Request', hint: 'Request validation rules & authorization' },
        { value: 'migration', label: 'Database Migration', hint: 'Schema definition with timestamps' },
      ],
      initialValues: ['model', 'controller', 'service', 'request', 'migration'],
      required: true,
    });

    if (p.isCancel(componentsPrompt)) handleCancel();
    selectedComponents = componentsPrompt as string[];
  } else {
    // TypeScript or fallback
    const componentsPrompt = await p.multiselect({
      message: `Select components to scaffold for ${pc.cyan(moduleName)}:`,
      options: [
        { value: 'controller', label: 'Controller', hint: 'Express request handlers & response orchestration' },
        { value: 'service', label: 'Service', hint: 'Application logic & repository coordination' },
        { value: 'repository', label: 'Repository', hint: 'Data persistence abstraction & queries' },
        { value: 'route', label: 'Router & Routes', hint: 'Express router mapping endpoints to controller' },
        { value: 'dto', label: 'DTOs & Interfaces', hint: 'Typed interfaces for entities and payloads' },
      ],
      initialValues: ['controller', 'service', 'repository', 'route', 'dto'],
      required: true,
    });

    if (p.isCancel(componentsPrompt)) handleCancel();
    selectedComponents = componentsPrompt as string[];
  }

  // Determine modular vs standard structure
  let isModular = true;
  if (cliOptions.modular) {
    isModular = true;
  } else if (cliOptions.standard) {
    isModular = false;
  } else {
    const defaultModular = projectInfo.type === 'laravel'
      ? Boolean(projectInfo.laravel?.isModular)
      : projectInfo.type === 'typescript'
        ? Boolean(projectInfo.typescript?.isModular)
        : true;

    const structurePrompt = await p.select({
      message: 'Choose folder architecture structure:',
      options: projectInfo.type === 'laravel'
        ? [
            {
              value: 'modular',
              label: 'Modular Domain Structure',
              hint: `app/Modules/${moduleName}/[Models, Controllers, Services]`,
            },
            {
              value: 'standard',
              label: 'Standard Laravel Structure',
              hint: `app/Models, app/Http/Controllers, app/Services`,
            },
          ]
        : [
            {
              value: 'modular',
              label: 'Modular Feature Structure',
              hint: `src/modules/${moduleName.toLowerCase()}/...`,
            },
            {
              value: 'standard',
              label: 'Layered Folder Structure',
              hint: `src/controllers, src/services, src/routes...`,
            },
          ],
      initialValue: defaultModular ? 'modular' : 'standard',
    });

    if (p.isCancel(structurePrompt)) handleCancel();
    isModular = structurePrompt === 'modular';
  }

  const spinner = p.spinner();
  spinner.start(`Generating boilerplate files for ${pc.cyan(moduleName)}...`);

  const result: ScaffoldResult = await scaffoldModule(projectInfo, {
    moduleName,
    components: selectedComponents,
    isModular,
    dryRun: cliOptions.dryRun,
    forceOverwrite: cliOptions.force,
  });

  spinner.stop('Generation finished!');

  // Report files status
  const fileLines = result.files.map((f) => {
    if (f.status === 'created') {
      return `  ${pc.green('✔')} ${f.relativeFilePath} ${pc.gray('(created)')}`;
    } else if (f.status === 'skipped') {
      return `  ${pc.yellow('⚠')} ${f.relativeFilePath} ${pc.yellow(`(skipped - ${f.reason})`)}`;
    } else {
      return `  ${pc.red('✖')} ${f.relativeFilePath} ${pc.red(`(error - ${f.reason})`)}`;
    }
  });

  p.note(
    fileLines.join('\n') +
    `\n\n${pc.bold('Summary:')} ${pc.green(`${result.createdCount} created`)}, ${pc.yellow(`${result.skippedCount} skipped`)}, ${pc.red(`${result.errorCount} errors`)}`,
    pc.cyan(`Module Scaffolding: ${moduleName}`)
  );

  if (result.skippedCount > 0 && !cliOptions.force) {
    p.log.warn(pc.yellow('Anti-Overwrite Protection prevented modifying existing files. Use --force to overwrite if intended.'));
  }

  p.outro(pc.green(`✨ Successfully scaffolded ${moduleName} module!`));
}

/**
 * Display quick project info
 */
function showProjectInfo(projectInfo: ProjectInfo) {
  let details = `${pc.bold('Project Name:')} ${projectInfo.name}\n` +
    `${pc.bold('Project Type:')} ${projectInfo.type.toUpperCase()}\n` +
    `${pc.bold('Flavor / Stack:')} ${projectInfo.summary}\n` +
    `${pc.bold('Working Path:')} ${projectInfo.rootPath}`;

  if (projectInfo.type === 'laravel' && projectInfo.laravel) {
    details += `\n${pc.bold('Filament Admin:')} ${projectInfo.laravel.hasFilament ? pc.green('Yes') : 'No'}` +
      `\n${pc.bold('Livewire:')} ${projectInfo.laravel.hasLivewire ? pc.green('Yes') : 'No'}` +
      `\n${pc.bold('Inertia.js:')} ${projectInfo.laravel.hasInertia ? pc.green('Yes') : 'No'}` +
      `\n${pc.bold('Modular App:')} ${projectInfo.laravel.isModular ? pc.green('Yes') : 'No'}`;
  } else if (projectInfo.type === 'typescript' && projectInfo.typescript) {
    details += `\n${pc.bold('Framework:')} ${projectInfo.typescript.framework}` +
      `\n${pc.bold('Prisma ORM:')} ${projectInfo.typescript.hasPrisma ? pc.green('Yes') : 'No'}` +
      `\n${pc.bold('Monorepo:')} ${projectInfo.typescript.isMonorepo ? pc.green('Yes') : 'No'}` +
      `\n${pc.bold('Modular Src:')} ${projectInfo.typescript.isModular ? pc.green('Yes') : 'No'}`;
  }

  p.note(details, pc.cyan('Detected Project Architecture'));
}

/**
 * CLI Main Entrypoint
 */
async function main() {
  const args = process.argv.slice(2);

  // Flags check
  if (args.includes('--help') || args.includes('-h') || args[0] === 'help') {
    showHelp();
    return;
  }

  if (args.includes('--version') || args.includes('-v')) {
    console.log(`archmind v${VERSION}`);
    return;
  }

  // Parse simple CLI flags
  let outputPath = 'ARCHITECTURE.md';
  const outputIdx = args.findIndex((a) => a === '--output' || a === '-o');
  if (outputIdx !== -1 && args[outputIdx + 1]) {
    outputPath = args[outputIdx + 1];
  }

  const isModularFlag = args.includes('--modular') || args.includes('-m');
  const isStandardFlag = args.includes('--standard') || args.includes('-s');
  const isForceFlag = args.includes('--force') || args.includes('-f');
  const isDryRunFlag = args.includes('--dry-run');

  const command = args[0] && !args[0].startsWith('-') ? args[0] : null;

  // Auto-detect project type in current working directory
  const projectInfo = await detectProjectType(process.cwd());

  // Non-interactive command routing
  if (command === 'scan') {
    p.intro(`${pc.bgCyan(pc.black(' ArchMind '))} ${pc.gray(`v${VERSION}`)} - Scanning Architecture`);
    p.log.info(`Detected: ${pc.green(projectInfo.summary)}`);
    await runScan(projectInfo, outputPath);
    return;
  }

  if (command === 'scaffold' || command === 'make') {
    const moduleName = args[1] && !args[1].startsWith('-') ? args[1] : undefined;
    p.intro(`${pc.bgCyan(pc.black(' ArchMind '))} ${pc.gray(`v${VERSION}`)} - Module Scaffolder`);
    p.log.info(`Target Project: ${pc.green(projectInfo.summary)}`);
    await runScaffold(projectInfo, moduleName, {
      modular: isModularFlag,
      standard: isStandardFlag,
      force: isForceFlag,
      dryRun: isDryRunFlag,
    });
    return;
  }

  if (command === 'info') {
    p.intro(`${pc.bgCyan(pc.black(' ArchMind '))} ${pc.gray(`v${VERSION}`)}`);
    showProjectInfo(projectInfo);
    p.outro(pc.cyan('Done.'));
    return;
  }

  // Interactive Menu Mode
  p.intro(`${pc.bgCyan(pc.black(' ArchMind '))} ${pc.bold('Smart Architecture Visualizer & Scaffolder')} ${pc.gray(`v${VERSION}`)}`);

  p.log.info(`Working Directory: ${pc.gray(process.cwd())}`);
  p.log.info(`Detected Architecture: ${pc.bold(pc.green(projectInfo.summary))}`);

  const action = await p.select({
    message: 'What would you like to do?',
    options: [
      {
        value: 'scan',
        label: '🔍 Scan Architecture & Generate ARCHITECTURE.md',
        hint: 'Creates component stats, directory tree & Mermaid flowchart',
      },
      {
        value: 'scaffold',
        label: '🏗️  Scaffold New Feature / Module',
        hint: 'Interactively generate boilerplate components with safety checks',
      },
      {
        value: 'info',
        label: '📊 Inspect Detected Architecture Details',
        hint: 'View detected frameworks, ORMs, and configurations',
      },
      {
        value: 'exit',
        label: '🚪 Exit',
      },
    ],
  });

  if (p.isCancel(action) || action === 'exit') {
    handleCancel();
  }

  if (action === 'scan') {
    await runScan(projectInfo, outputPath);
  } else if (action === 'scaffold') {
    await runScaffold(projectInfo, undefined, {
      modular: isModularFlag,
      standard: isStandardFlag,
      force: isForceFlag,
      dryRun: isDryRunFlag,
    });
  } else if (action === 'info') {
    showProjectInfo(projectInfo);
    p.outro(pc.cyan('Done!'));
  }
}

main().catch((err) => {
  p.log.error(pc.red(`Fatal error: ${err.message || String(err)}`));
  process.exit(1);
});
