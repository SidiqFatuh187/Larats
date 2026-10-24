# LaraTS ⚡

> **Smart Architecture Visualizer & Contextual Module Scaffolder CLI**  
> Tailor-made for **Laravel** & **TypeScript** (Node.js / Express / React / Monorepo) projects.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Offline First](https://img.shields.io/badge/Security-100%25%20Offline-success.svg)](#-strict-security--safety-guarantees)

---

## 💡 What is LaraTS?

When codebases grow large, developers often struggle to understand the architecture or keep module structures consistent across teams. **LaraTS** solves this with two core capabilities:

1. 🔍 **Architecture Scanner & Visualizer (`scan`)**: Instantly scans your repository, categorizes layers (Models, Controllers, Services, Actions, Filament Resources, Routes, etc.), and generates a clean `ARCHITECTURE.md` with an interactive **Mermaid.js flowchart** and directory tree.
2. 🏗️ **Contextual Module Scaffolder (`scaffold` / `make`)**: Quickly generates cohesive feature modules with clean, production-ready boilerplate code tailored to your exact stack (Laravel or TypeScript).
3. 🔒 **100% Local & Secure**: No data ever leaves your computer. Sensitive files (`.env`, private keys, vendor folders) are strictly excluded.

---

## 🚀 Quick Start

Run instantly without installation via `npx`:

```bash
# Interactive menu mode
npx larats

# Or scan architecture directly
npx larats scan

# Or scaffold a new module directly
npx larats scaffold Payment
```

Or install globally:

```bash
npm install -g larats
larats
```

---

## ✨ Key Features

### 1. 🔍 Auto-Detection & Safe Scanner
LaraTS inspects configuration files to detect your stack:
- **Laravel**: Detects Laravel version, Filament Admin panel, Livewire, Inertia.js, Sanctum, and Modular architecture.
- **TypeScript**: Detects Express, NestJS, Fastify, Next.js, React, Prisma ORM, TypeORM, Drizzle, Monorepos, and Modular setups.

When you run `larats scan`:
- Indexes architectural components (Counts and samples).
- Builds a clean, high-level directory tree.
- Generates an interactive **Mermaid.js flowchart (`flowchart TD`)** showing the entire request lifecycle across layers.
- Outputs a comprehensive `ARCHITECTURE.md` file.

### 2. 🏗️ Contextual Module Scaffolder
Create new features in seconds with consistent boilerplate:

- **Laravel Options**:
  - `Model`: Eloquent model with `$table`, `$fillable`, and `$casts`.
  - `Controller`: Resourceful API Controller with Dependency-Injected Service.
  - `Service`: Encapsulated business logic service (`getAll`, `getById`, `create`, `update`, `delete`).
  - `Action`: Single-responsibility invokable class (`execute` method).
  - `FormRequest`: Authorization and validation rules.
  - `Migration`: Timestamped schema migration.
  - **Structure choices**: Modular Domain (`app/Modules/<Name>`) or Standard Laravel (`app/Models`, `app/Http/Controllers`, etc.).

- **TypeScript Options**:
  - `Controller`: Express request handler with error handling.
  - `Service`: Business logic service.
  - `Repository`: Data access layer interface and implementation.
  - `Route`: Express router connected to controller actions.
  - `DTO / Schema`: Strongly-typed TypeScript interfaces and payloads.
  - `Barrel Export`: Automatic `index.ts` export for modular cohesion.
  - **Structure choices**: Feature Module (`src/modules/<name>/...`) or Layered structure (`src/controllers/`, `src/services/`, etc.).

### 3. 🛡️ Anti-Overwrite Protection
LaraTS will **NEVER** silently overwrite your existing code. If a target file already exists, LaraTS skips it and alerts you. You can only overwrite files by explicitly providing `--force`.

---

## 🔒 Strict Security & Safety Guarantees

LaraTS was engineered from the ground up for strict security:
- **100% Offline & Local**: Zero network calls, telemetry, or third-party tracking.
- **Strict Ignore List (`SAFE_IGNORE_LIST`)**:
  - Never reads or includes `**/node_modules/**`, `**/vendor/**`, `**/.git/**`, `**/storage/**`, `**/dist/**`, `**/build/**`.
  - Never exposes environment files: `**/.env*`, `**/*.pem`, `**/*.key`, `**/*.pfx`, `**/*.cert`.
  - Never indexes lock/log files: `**/*.log`, `**/*.lock`, `package-lock.json`, `pnpm-lock.yaml`, `composer.lock`.
- **Metadata Only**: Scanner only analyzes file paths and relative folder structures; no private application configurations or secrets are extracted.

---

## 💻 CLI Usage & Commands

```text
USAGE:
  $ npx larats [command] [options]
  $ larats [command] [options]

COMMANDS:
  scan                 Scan repository & generate ARCHITECTURE.md
  scaffold, make [name] Scaffold a new module or feature with clean boilerplate
  info                 Show detected project type & architectural flavor
  help                 Display help message

OPTIONS:
  -o, --output <file>    Output markdown path for scan (default: ARCHITECTURE.md)
  -m, --modular          Enforce modular directory structure
  -s, --standard         Enforce standard/layered directory structure
  --dry-run              Simulate generation without writing files
  -f, --force            Overwrite files if they already exist
  -v, --version          Display CLI version
  -h, --help             Display help message
```

### Examples

```bash
# Scan and save to custom documentation path
larats scan --output docs/ARCHITECTURE.md

# Scaffold a 'Payment' module with modular structure
larats scaffold Payment --modular

# Dry-run test scaffolding without writing files
larats scaffold Order --dry-run
```

---

## 🛠️ Development & Contributing

```bash
# Clone repository
git clone https://github.com/SidiqFatuh187/Larats.git
cd Larats

# Install dependencies
npm install

# Run test suite
npm test

# Build distribution bundle
npm run build

# Run local build
node dist/index.js
```

---

## 📄 License

Licensed under the [MIT License](LICENSE).
