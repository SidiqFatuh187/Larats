import type { ScanResult } from '../scanner.js';

/**
 * Generate a dynamic Mermaid.js diagram representing only the components and layers
 * that actually exist in the scanned codebase.
 */
export function generateMermaidDiagram(scanResult: ScanResult): string {
  const { projectInfo, components, modules } = scanResult;

  if (projectInfo.type === 'laravel') {
    const hasFilament = projectInfo.laravel?.hasFilament || (components['Filament Resources']?.count ?? 0) > 0;
    const hasActions = (components['Actions']?.count ?? 0) > 0;
    const hasServices = (components['Services']?.count ?? 0) > 0;
    const hasRequests = (components['Form Requests']?.count ?? 0) > 0;
    const hasModels = (components['Models']?.count ?? 0) > 0;
    const hasMigrations = (components['Migrations']?.count ?? 0) > 0;

    let diagram = `flowchart TD
    %% Styling Definitions
    classDef client fill:#E0F2FE,stroke:#0284C7,stroke-width:2px,color:#0369A1;
    classDef routing fill:#FEF3C7,stroke:#D97706,stroke-width:2px,color:#B45309;
    classDef controller fill:#DCFCE7,stroke:#16A34A,stroke-width:2px,color:#15803D;
    classDef service fill:#F3E8FF,stroke:#9333EA,stroke-width:2px,color:#7E22CE;
    classDef data fill:#FEE2E2,stroke:#DC2626,stroke-width:2px,color:#B91C1C;
    classDef db fill:#F1F5F9,stroke:#475569,stroke-width:2px,color:#334155;

    subgraph EntryLayer ["1. Client & Entrypoints"]
        Client["Client / Browser / API Consumer"]:::client
        Routes["HTTP Routes<br/>(routes/web.php, routes/api.php)"]:::routing
    end
`;

    if (hasRequests) {
      diagram += `
    subgraph RequestLayer ["2. Request Pipeline & Validation"]
        Middleware["Middleware Pipeline<br/>(Auth, CSRF, Rate Limiting)"]:::routing
        FormRequests["Form Requests<br/>(Validation & Authorization)"]:::routing
    end
`;
    }

    diagram += `
    subgraph HttpLayer ["3. Controllers & Presentation"]
        Controllers["HTTP Controllers<br/>(app/Http/Controllers)"]:::controller
`;
    if (hasFilament) {
      diagram += `        Filament["Filament Admin Resources<br/>(app/Filament/Resources)"]:::controller\n`;
    }
    diagram += `    end\n`;

    if (hasServices || hasActions) {
      diagram += `
    subgraph DomainLayer ["4. Domain & Business Logic"]
`;
      if (hasServices) {
        diagram += `        Services["Service Classes<br/>(app/Services)"]:::service\n`;
      }
      if (hasActions) {
        diagram += `        Actions["Action Classes<br/>(app/Actions)"]:::service\n`;
      }
      diagram += `    end\n`;
    }

    diagram += `
    subgraph DataLayer ["5. Data Persistence & Storage"]
`;
    if (hasModels) {
      diagram += `        Models["Eloquent Models<br/>(app/Models)"]:::data\n`;
    }
    diagram += `        Database[("Database<br/>(MySQL / Postgres / SQLite)")]:::db\n`;
    if (hasMigrations) {
      diagram += `        Migrations["Database Migrations<br/>(database/migrations)"]:::data\n`;
    }
    diagram += `    end\n\n`;

    // Connect nodes dynamically
    diagram += `    Client --> Routes\n`;

    if (hasRequests) {
      diagram += `    Routes --> Middleware\n`;
      diagram += `    Middleware --> FormRequests\n`;
      diagram += `    FormRequests --> Controllers\n`;
    } else {
      diagram += `    Routes --> Controllers\n`;
    }

    if (hasServices && hasActions) {
      diagram += `    Controllers --> Services\n`;
      diagram += `    Controllers --> Actions\n`;
      if (hasModels) {
        diagram += `    Services --> Models\n`;
        diagram += `    Actions --> Models\n`;
      } else {
        diagram += `    Services --> Database\n`;
        diagram += `    Actions --> Database\n`;
      }
    } else if (hasServices) {
      diagram += `    Controllers --> Services\n`;
      if (hasModels) {
        diagram += `    Services --> Models\n`;
      } else {
        diagram += `    Services --> Database\n`;
      }
    } else if (hasActions) {
      diagram += `    Controllers --> Actions\n`;
      if (hasModels) {
        diagram += `    Actions --> Models\n`;
      } else {
        diagram += `    Actions --> Database\n`;
      }
    } else {
      if (hasModels) {
        diagram += `    Controllers --> Models\n`;
      } else {
        diagram += `    Controllers --> Database\n`;
      }
    }

    if (hasFilament) {
      if (hasModels) {
        diagram += `    Client --> Filament\n    Filament --> Models\n`;
      } else {
        diagram += `    Client --> Filament\n    Filament --> Database\n`;
      }
    }

    if (hasModels) {
      diagram += `    Models --> Database\n`;
    }
    if (hasMigrations) {
      diagram += `    Migrations -.-> Database\n`;
    }

    if (modules.length > 0) {
      diagram += `\n    subgraph ModulesLayer ["📦 Detected Modules (${modules.length})"]\n`;
      modules.slice(0, 6).forEach((mod, idx) => {
        diagram += `        Mod_${idx}["${mod} Module"]:::service\n`;
      });
      if (modules.length > 6) {
        diagram += `        Mod_More["...and ${modules.length - 6} more modules"]:::service\n`;
      }
      diagram += `    end\n`;
    }

    return diagram;
  }

  if (projectInfo.type === 'typescript') {
    const rawFw = projectInfo.typescript?.framework || 'express';
    const fwDisplay =
      rawFw !== 'unknown' && rawFw !== 'node-vanilla'
        ? `${rawFw.charAt(0).toUpperCase() + rawFw.slice(1)} Router`
        : 'API Endpoints & Handlers';

    const orm = projectInfo.typescript?.hasPrisma ? 'Prisma' : projectInfo.typescript?.hasTypeORM ? 'TypeORM' : projectInfo.typescript?.hasDrizzle ? 'Drizzle' : null;

    const hasControllers = (components['Controllers']?.count ?? 0) > 0;
    const hasServices = (components['Services']?.count ?? 0) > 0;
    const hasRepositories = (components['Repositories']?.count ?? 0) > 0;
    const hasDtos = (components['DTOs & Schemas']?.count ?? 0) > 0;
    const hasUi = (components['UI Components']?.count ?? 0) > 0;
    const hasModels = (components['Models & Entities']?.count ?? 0) > 0;
    const hasAnyLayer = hasControllers || hasServices || hasRepositories || hasDtos || hasUi || hasModels;

    if (hasAnyLayer) {
      let diagram = `flowchart TD
    %% Styling Definitions
    classDef client fill:#E0F2FE,stroke:#0284C7,stroke-width:2px,color:#0369A1;
    classDef routing fill:#FEF3C7,stroke:#D97706,stroke-width:2px,color:#B45309;
    classDef controller fill:#DCFCE7,stroke:#16A34A,stroke-width:2px,color:#15803D;
    classDef service fill:#F3E8FF,stroke:#9333EA,stroke-width:2px,color:#7E22CE;
    classDef data fill:#FEE2E2,stroke:#DC2626,stroke-width:2px,color:#B91C1C;
    classDef db fill:#F1F5F9,stroke:#475569,stroke-width:2px,color:#334155;

    subgraph EntryLayer ["1. Client & API Gateway"]
        Client["Frontend / API Client"]:::client
        Router["Router & Endpoints<br/>(${fwDisplay})"]:::routing
    end
`;

      if (hasUi) {
        diagram += `
    subgraph UiLayer ["Frontend Presentation"]
        UiComponents["UI Components<br/>(src/components)"]:::controller
    end
`;
      }

      if (hasDtos) {
        diagram += `
    subgraph ValidationLayer ["2. Validation & Schemas"]
        DTOs["DTOs & Schemas<br/>(Input Validation)"]:::routing
    end
`;
      }

      if (hasControllers) {
        diagram += `
    subgraph ControllerLayer ["3. Controllers"]
        Controllers["Controllers<br/>(Request Handling)"]:::controller
    end
`;
      }

      if (hasServices) {
        diagram += `
    subgraph ServiceLayer ["4. Application Services"]
        Services["Domain Services<br/>(Business Logic)"]:::service
    end
`;
      }

      diagram += `
    subgraph PersistenceLayer ["5. Data Layer & Storage"]
`;
      if (hasRepositories) {
        diagram += `        Repositories["Repositories / Data Access<br/>(${orm || 'Data Layer'})"]:::data\n`;
      } else if (hasModels) {
        diagram += `        Entities["Models & Entities<br/>(${orm || 'ORM'})"]:::data\n`;
      }
      diagram += `        Database[("Database / Storage")]:::db\n`;
      diagram += `    end\n\n`;

      // Dynamic Connections
      diagram += `    Client --> Router\n`;
      if (hasUi) {
        diagram += `    Client --> UiComponents\n`;
        diagram += `    UiComponents --> Router\n`;
      }

      let previousNode = 'Router';
      if (hasDtos) {
        diagram += `    ${previousNode} --> DTOs\n`;
        previousNode = 'DTOs';
      }

      if (hasControllers) {
        diagram += `    ${previousNode} --> Controllers\n`;
        previousNode = 'Controllers';
      }

      if (hasServices) {
        diagram += `    ${previousNode} --> Services\n`;
        previousNode = 'Services';
      }

      if (hasRepositories) {
        diagram += `    ${previousNode} --> Repositories\n`;
        diagram += `    Repositories --> Database\n`;
      } else if (hasModels) {
        diagram += `    ${previousNode} --> Entities\n`;
        diagram += `    Entities --> Database\n`;
      } else {
        diagram += `    ${previousNode} --> Database\n`;
      }

      if (modules.length > 0) {
        diagram += `\n    subgraph ModulesLayer ["📦 Detected Feature Modules (${modules.length})"]\n`;
        modules.slice(0, 6).forEach((mod, idx) => {
          diagram += `        Mod_${idx}["${mod} Module"]:::service\n`;
        });
        if (modules.length > 6) {
          diagram += `        Mod_More["...and ${modules.length - 6} more modules"]:::service\n`;
        }
        diagram += `    end\n`;
      }

      return diagram;
    }
  }

  // Generic / CLI projects
  const hasEntry = (components['Source Files']?.files || []).some((f) =>
    /(?:^|\/)(?:index|cli|main|bin)\.[a-z]+$/i.test(f)
  );
  const hasSource = (components['Source Files']?.count ?? 0) > 0;
  const hasTests = (components['Test Files']?.count ?? 0) > 0;

  let diagram = `flowchart TD
    classDef client fill:#E0F2FE,stroke:#0284C7,stroke-width:2px,color:#0369A1;
    classDef core fill:#DCFCE7,stroke:#16A34A,stroke-width:2px,color:#15803D;
    classDef test fill:#FEF3C7,stroke:#D97706,stroke-width:2px,color:#B45309;

    subgraph App ["CLI & Application Architecture"]
`;
  if (hasEntry) {
    diagram += `        Entry["Entrypoint CLI (bin/)"]:::client\n`;
  }
  if (hasSource) {
    diagram += `        Source["Core Modules & Generators (src/)"]:::core\n`;
  }
  if (hasTests) {
    diagram += `        Tests["Automated Test Suites (tests/)"]:::test\n`;
  }
  if (!hasEntry && !hasSource && !hasTests) {
    diagram += `        Source["Source Files"]:::core\n`;
  }
  diagram += `    end\n\n`;

  if (hasEntry && hasSource) {
    diagram += `    Entry --> Source\n`;
  }
  if (hasTests && hasSource) {
    diagram += `    Tests -.-> Source\n`;
  }

  return diagram;
}

/**
 * Generate full ARCHITECTURE.md markdown content.
 */
export function generateArchitectureMarkdown(scanResult: ScanResult): string {
  const { projectInfo, totalFilesScanned, components, modules, directoryTree } = scanResult;

  const mermaid = generateMermaidDiagram(scanResult);

  // Component statistics rows
  const componentRows = Object.entries(components)
    .map(([, comp]) => {
      const sampleFiles = comp.files.slice(0, 3).map((f) => `\`${f}\``).join(', ');
      const moreSuffix = comp.files.length > 3 ? ` *(+${comp.files.length - 3} more)*` : '';
      return `| **${comp.name}** | \`${comp.count}\` | ${comp.description} | ${sampleFiles || '-'} ${moreSuffix} |`;
    })
    .join('\n');

  // Modules section if present
  let modulesSection = '';
  if (modules.length > 0) {
    modulesSection = `
## 📦 Detected Modules & Domains (${modules.length})

This project organizes features into modular domains:

${modules.map((m) => `- **\`${m}\`**`).join('\n')}
`;
  }

  return `# 🏛️ Architecture Overview: ${projectInfo.name}

> Auto-generated by **[LaraTS CLI](https://github.com/SidiqFatuh187/Larats)**.  
> **100% Local & Safe:** Generated entirely in offline mode via local filesystem manifest & structure analysis. Zero data transmitted.

---

## 📌 Project Summary

| Attribute | Details |
| :--- | :--- |
| **Project Name** | \`${projectInfo.name}\` |
| **Project Type** | **${projectInfo.type.toUpperCase()}** |
| **Detected Stack** | \`${projectInfo.summary}\` |
| **Scanned Files** | \`${totalFilesScanned}\` files indexed (safe ignore filter applied) |

---

## 📊 Architectural Components Statistics

| Component Layer | Count | Description | Sample Files |
| :--- | :---: | :--- | :--- |
${componentRows || '| *No architectural components identified* | `0` | - | - |'}
${modulesSection}
---

## 🗺️ Visual Architecture Flowchart

Visual representation of the project layers and request lifecycle rendered with [Mermaid.js](https://mermaid.js.org/):

\`\`\`mermaid
${mermaid}
\`\`\`

---

## 🌲 Directory Structure Tree

Clean, high-level directory tree showing key folders (ignoring build artifacts, vendor files, and sensitive keys):

\`\`\`text
${directoryTree || '(Empty directory structure)'}
\`\`\`

---

## 🔒 Security & Privacy Notice

This architectural map was produced with strict privacy guarantees:
- **Zero Network Transmission:** Executed locally without telemetry, tracking, or outbound communication.
- **Safe Exclusion Filter:** Ignored \`node_modules\`, \`vendor\`, \`.env*\`, key files, credentials, and cache folders.
- **Manifest & Structure Only:** Safely reads standard manifest dependencies (\`package.json\` / \`composer.json\`) to determine framework types, and relative file paths to categorize components. Never reads private configurations or file contents.

*Generated with ❤️ by LaraTS CLI.*
`;
}
