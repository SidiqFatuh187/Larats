import type { ScanResult } from '../scanner.js';

/**
 * Generate a Mermaid.js diagram representing the architecture layers and flow.
 */
export function generateMermaidDiagram(scanResult: ScanResult): string {
  const { projectInfo, components, modules } = scanResult;

  if (projectInfo.type === 'laravel') {
    const hasFilament = projectInfo.laravel?.hasFilament || (components['Filament Resources']?.count ?? 0) > 0;
    const hasActions = (components['Actions']?.count ?? 0) > 0;
    const hasServices = (components['Services']?.count ?? 0) > 0;

    let diagram = `flowchart TD
    %% Styling Definitions
    classDef client fill:#E0F2FE,stroke:#0284C7,stroke-width:2px,color:#0369A1;
    classDef routing fill:#FEF3C7,stroke:#D97706,stroke-width:2px,color:#B45309;
    classDef controller fill:#DCFCE7,stroke:#16A34A,stroke-width:2px,color:#15803D;
    classDef service fill:#F3E8FF,stroke:#9333EA,stroke-width:2px,color:#7E22CE;
    classDef data fill:#FEE2E2,stroke:#DC2626,stroke-width:2px,color:#B91C1C;
    classDef db fill:#F1F5F9,stroke:#475569,stroke-width:2px,color:#334155;

    subgraph Layer1 ["1. Client & Entrypoints"]
        Client["Client / Browser / API Consumer"]:::client
        Routes["HTTP Routes<br/>(routes/web.php, routes/api.php)"]:::routing
    end

    subgraph Layer2 ["2. Request Pipeline & Security"]
        Middleware["Middleware Pipeline<br/>(Auth, CSRF, Rate Limiting)"]:::routing
        FormRequests["Form Requests<br/>(Validation & Authorization)"]:::routing
    end

    subgraph Layer3 ["3. Controllers & Presentation"]
        Controllers["HTTP Controllers<br/>(app/Http/Controllers)"]:::controller
`;

    if (hasFilament) {
      diagram += `        Filament["Filament Admin Panel<br/>(app/Filament/Resources)"]:::controller\n`;
    }

    diagram += `    end

    subgraph Layer4 ["4. Domain & Business Logic"]
`;

    if (hasServices || !hasActions) {
      diagram += `        Services["Service Layer<br/>(app/Services)"]:::service\n`;
    }
    if (hasActions) {
      diagram += `        Actions["Action Classes<br/>(app/Actions)"]:::service\n`;
    }

    diagram += `    end

    subgraph Layer5 ["5. Data Persistence & Storage"]
        Models["Eloquent Models<br/>(app/Models)"]:::data
        Database[("Database<br/>(MySQL / Postgres / SQLite)")]:::db
        Migrations["Database Migrations<br/>(database/migrations)"]:::data
    end

    Client --> Routes
    Routes --> Middleware
    Middleware --> FormRequests
    FormRequests --> Controllers
`;

    if (hasServices && hasActions) {
      diagram += `    Controllers --> Services\n    Controllers --> Actions\n    Services --> Models\n    Actions --> Models\n`;
    } else if (hasActions) {
      diagram += `    Controllers --> Actions\n    Actions --> Models\n`;
    } else {
      diagram += `    Controllers --> Services\n    Services --> Models\n`;
    }

    if (hasFilament) {
      diagram += `    Client --> Filament\n    Filament --> Models\n`;
    }

    diagram += `    Models --> Database\n    Migrations -.-> Database\n`;

    // If modular Laravel
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
    const fw = projectInfo.typescript?.framework || 'Express';
    const orm = projectInfo.typescript?.hasPrisma ? 'Prisma' : projectInfo.typescript?.hasTypeORM ? 'TypeORM' : 'ORM';

    let diagram = `flowchart TD
    %% Styling Definitions
    classDef client fill:#E0F2FE,stroke:#0284C7,stroke-width:2px,color:#0369A1;
    classDef routing fill:#FEF3C7,stroke:#D97706,stroke-width:2px,color:#B45309;
    classDef controller fill:#DCFCE7,stroke:#16A34A,stroke-width:2px,color:#15803D;
    classDef service fill:#F3E8FF,stroke:#9333EA,stroke-width:2px,color:#7E22CE;
    classDef data fill:#FEE2E2,stroke:#DC2626,stroke-width:2px,color:#B91C1C;
    classDef db fill:#F1F5F9,stroke:#475569,stroke-width:2px,color:#334155;

    subgraph Layer1 ["1. Client & API Gateway"]
        Client["Frontend / API Client"]:::client
        Router["Router & Endpoints<br/>(${fw} Routes)"]:::routing
    end

    subgraph Layer2 ["2. Validation & Guards"]
        Middleware["Auth & Error Middleware"]:::routing
        DTOs["DTOs & Schemas<br/>(Input Validation)"]:::routing
    end

    subgraph Layer3 ["3. Controllers"]
        Controllers["Controllers<br/>(Request Handling)"]:::controller
    end

    subgraph Layer4 ["4. Application Services"]
        Services["Domain Services<br/>(Business Logic)"]:::service
    end

    subgraph Layer5 ["5. Data Layer & Storage"]
        Repositories["Repositories / ${orm}<br/>(Data Access Layer)"]:::data
        Database[("Database<br/>(SQL / NoSQL)")]:::db
    end

    Client --> Router
    Router --> Middleware
    Middleware --> DTOs
    DTOs --> Controllers
    Controllers --> Services
    Services --> Repositories
    Repositories --> Database
`;

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

  // Generic diagram
  return `flowchart TD
    classDef client fill:#E0F2FE,stroke:#0284C7,stroke-width:2px,color:#0369A1;
    classDef core fill:#DCFCE7,stroke:#16A34A,stroke-width:2px,color:#15803D;
    classDef test fill:#FEF3C7,stroke:#D97706,stroke-width:2px,color:#B45309;

    subgraph App ["Application Architecture"]
        Entry["Entrypoint / CLI"]:::client
        Source["Source Core Logic (src/)"]:::core
        Tests["Test Suites"]:::test
    end

    Entry --> Source
    Tests -.-> Source
`;
}

/**
 * Generate full ARCHITECTURE.md markdown content.
 */
export function generateArchitectureMarkdown(scanResult: ScanResult): string {
  const { projectInfo, totalFilesScanned, components, modules, directoryTree, scanDurationMs } = scanResult;
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';

  const mermaid = generateMermaidDiagram(scanResult);

  // Component statistics rows
  const componentRows = Object.entries(components)
    .map(([key, comp]) => {
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

> Auto-generated by **[ArchMind CLI](https://github.com/archmind-cli)** on \`${timestamp}\`.  
> **100% Local & Safe:** Generated entirely in offline mode via local filesystem metadata analysis. Zero data transmitted.

---

## 📌 Project Summary

| Attribute | Details |
| :--- | :--- |
| **Project Name** | \`${projectInfo.name}\` |
| **Project Type** | **${projectInfo.type.toUpperCase()}** |
| **Detected Stack** | \`${projectInfo.summary}\` |
| **Scanned Files** | \`${totalFilesScanned}\` files indexed (safe ignore filter applied) |
| **Scan Duration** | \`${scanDurationMs} ms\` |

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

This architectural map was produced with strict privacy rules:
- **Zero Network Transmission:** Executed locally without telemetry or outbound communication.
- **Safe Exclusion Filter:** Ignored \`node_modules\`, \`vendor\`, \`.env*\`, key files, credentials, and cache folders.
- **Metadata Only:** Scanned file names and relative paths only; no secrets or private business contents were extracted.

*Generated with ❤️ by ArchMind CLI.*
`;
}

