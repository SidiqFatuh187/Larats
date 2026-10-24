import type { NamingVariations } from './laravel.js';

export function tsControllerTemplate(names: NamingVariations, isModular: boolean = true): string {
  const serviceImport = isModular ? `./${names.kebab}.service.js` : `../services/${names.kebab}.service.js`;
  const dtoImport = isModular ? `./${names.kebab}.dto.js` : `../dtos/${names.kebab}.dto.js`;

  return `import type { Request, Response, NextFunction } from 'express';
import { ${names.pascal}Service } from '${serviceImport}';
import type { Create${names.pascal}Dto, Update${names.pascal}Dto } from '${dtoImport}';

export class ${names.pascal}Controller {
  constructor(private readonly ${names.camel}Service: ${names.pascal}Service = new ${names.pascal}Service()) {}

  /**
   * GET /api/${names.kebab}
   */
  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const items = await this.${names.camel}Service.findAll(req.query);
      res.status(200).json({ status: 'success', data: items });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/${names.kebab}/:id
   */
  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const item = await this.${names.camel}Service.findById(id);
      if (!item) {
        res.status(404).json({ status: 'fail', message: '${names.pascal} not found' });
        return;
      }
      res.status(200).json({ status: 'success', data: item });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/${names.kebab}
   */
  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const payload: Create${names.pascal}Dto = req.body;
      const created = await this.${names.camel}Service.create(payload);
      res.status(201).json({ status: 'success', data: created });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PUT /api/${names.kebab}/:id
   */
  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const payload: Update${names.pascal}Dto = req.body;
      const updated = await this.${names.camel}Service.update(id, payload);
      res.status(200).json({ status: 'success', data: updated });
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/${names.kebab}/:id
   */
  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      await this.${names.camel}Service.delete(id);
      res.status(200).json({ status: 'success', message: '${names.pascal} deleted successfully' });
    } catch (error) {
      next(error);
    }
  };
}
`;
}

export function tsServiceTemplate(names: NamingVariations, isModular: boolean = true): string {
  const repoImport = isModular ? `./${names.kebab}.repository.js` : `../repositories/${names.kebab}.repository.js`;
  const dtoImport = isModular ? `./${names.kebab}.dto.js` : `../dtos/${names.kebab}.dto.js`;

  return `import { ${names.pascal}Repository } from '${repoImport}';
import type { ${names.pascal}Entity, Create${names.pascal}Dto, Update${names.pascal}Dto } from '${dtoImport}';

export class ${names.pascal}Service {
  constructor(private readonly ${names.camel}Repository: ${names.pascal}Repository = new ${names.pascal}Repository()) {}

  async findAll(query: Record<string, any> = {}): Promise<${names.pascal}Entity[]> {
    return this.${names.camel}Repository.findAll(query);
  }

  async findById(id: string): Promise<${names.pascal}Entity | null> {
    return this.${names.camel}Repository.findById(id);
  }

  async create(data: Create${names.pascal}Dto): Promise<${names.pascal}Entity> {
    return this.${names.camel}Repository.create(data);
  }

  async update(id: string, data: Update${names.pascal}Dto): Promise<${names.pascal}Entity> {
    return this.${names.camel}Repository.update(id, data);
  }

  async delete(id: string): Promise<boolean> {
    return this.${names.camel}Repository.delete(id);
  }
}
`;
}

export function tsRepositoryTemplate(names: NamingVariations, isModular: boolean = true): string {
  const dtoImport = isModular ? `./${names.kebab}.dto.js` : `../dtos/${names.kebab}.dto.js`;

  return `import type { ${names.pascal}Entity, Create${names.pascal}Dto, Update${names.pascal}Dto } from '${dtoImport}';

export interface I${names.pascal}Repository {
  findAll(query?: Record<string, any>): Promise<${names.pascal}Entity[]>;
  findById(id: string): Promise<${names.pascal}Entity | null>;
  create(data: Create${names.pascal}Dto): Promise<${names.pascal}Entity>;
  update(id: string, data: Update${names.pascal}Dto): Promise<${names.pascal}Entity>;
  delete(id: string): Promise<boolean>;
}

export class ${names.pascal}Repository implements I${names.pascal}Repository {
  // In-memory store fallback. Replace with Prisma / TypeORM / Drizzle client calls.
  private storage: Map<string, ${names.pascal}Entity> = new Map();

  async findAll(_query?: Record<string, any>): Promise<${names.pascal}Entity[]> {
    return Array.from(this.storage.values());
  }

  async findById(id: string): Promise<${names.pascal}Entity | null> {
    return this.storage.get(id) || null;
  }

  async create(data: Create${names.pascal}Dto): Promise<${names.pascal}Entity> {
    const id = (Math.random() * 100000).toFixed(0);
    const newRecord: ${names.pascal}Entity = {
      id,
      ...data,
      status: data.status || 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.storage.set(id, newRecord);
    return newRecord;
  }

  async update(id: string, data: Update${names.pascal}Dto): Promise<${names.pascal}Entity> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(\`${names.pascal} with id \${id} not found\`);
    }
    const updated: ${names.pascal}Entity = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    };
    this.storage.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.storage.delete(id);
  }
}
`;
}

export function tsRoutesTemplate(names: NamingVariations, isModular: boolean = true): string {
  const controllerImport = isModular ? `./${names.kebab}.controller.js` : `../controllers/${names.kebab}.controller.js`;

  return `import { Router } from 'express';
import { ${names.pascal}Controller } from '${controllerImport}';

const router = Router();
const controller = new ${names.pascal}Controller();

/**
 * Route declarations for ${names.pascal}
 */
router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.delete);

export const ${names.camel}Routes = router;
export default router;
`;
}

export function tsDtoTemplate(names: NamingVariations): string {
  return `export interface ${names.pascal}Entity {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'archived';
  description?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Create${names.pascal}Dto {
  name: string;
  status?: 'draft' | 'active' | 'archived';
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface Update${names.pascal}Dto {
  name?: string;
  status?: 'draft' | 'active' | 'archived';
  description?: string;
  metadata?: Record<string, unknown>;
}
`;
}
