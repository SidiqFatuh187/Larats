export interface NamingVariations {
  pascal: string;     // e.g. PaymentOrder
  camel: string;      // e.g. paymentOrder
  kebab: string;      // e.g. payment-order
  snake: string;      // e.g. payment_order
  pluralSnake: string;// e.g. payment_orders
  pluralPascal: string;// e.g. PaymentOrders
}

export function getNaming(input: string): NamingVariations {
  // Clean string and split on camelCase/PascalCase boundaries and separators
  const words = input
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    words.push('SampleModule');
  }

  const pascal = words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');

  const camel = pascal.charAt(0).toLowerCase() + pascal.slice(1);

  const snake = words.map((w) => w.toLowerCase()).join('_');

  const kebab = words.map((w) => w.toLowerCase()).join('-');

  // Basic pluralization
  const pluralSuffix = snake.endsWith('s') || snake.endsWith('ch') || snake.endsWith('sh') ? 'es' : 's';
  const pluralSnake = snake + pluralSuffix;
  const pluralPascal = pascal + pluralSuffix;

  return { pascal, camel, kebab, snake, pluralSnake, pluralPascal };
}

export function laravelModelTemplate(names: NamingVariations, namespace: string = 'App\\Models'): string {
  return `<?php

namespace ${namespace};

use Illuminate\\Database\\Eloquent\\Factories\\HasFactory;
use Illuminate\\Database\\Eloquent\\Model;

class ${names.pascal} extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = '${names.pluralSnake}';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'status',
        'metadata',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }
}
`;
}

export function laravelControllerTemplate(
  names: NamingVariations,
  options: {
    namespace?: string;
    modelNamespace?: string;
    serviceNamespace?: string;
    requestNamespace?: string;
  } = {}
): string {
  const namespace = options.namespace || 'App\\Http\\Controllers';
  const modelNamespace = options.modelNamespace || 'App\\Models';
  const serviceNamespace = options.serviceNamespace || 'App\\Services';
  const requestNamespace = options.requestNamespace || 'App\\Http\\Requests';

  const baseControllerImport =
    namespace !== 'App\\Http\\Controllers' ? 'use App\\Http\\Controllers\\Controller;\n' : '';

  return `<?php

namespace ${namespace};

${baseControllerImport}use ${modelNamespace}\\${names.pascal};
use ${serviceNamespace}\\${names.pascal}Service;
use ${requestNamespace}\\${names.pascal}Request;
use Illuminate\\Http\\JsonResponse;
use Illuminate\\Http\\Request;

class ${names.pascal}Controller extends Controller
{
    public function __construct(
        protected ${names.pascal}Service $${names.camel}Service
    ) {}

    /**
     * Display a listing of ${names.pascal} resources.
     */
    public function index(Request $request): JsonResponse
    {
        $items = $this->${names.camel}Service->getAll($request->all());

        return response()->json([
            'status' => 'success',
            'data' => $items,
        ]);
    }

    /**
     * Display the specified ${names.pascal} resource.
     */
    public function show(int $id): JsonResponse
    {
        $item = $this->${names.camel}Service->getById($id);

        return response()->json([
            'status' => 'success',
            'data' => $item,
        ]);
    }

    /**
     * Store a newly created ${names.pascal} in storage.
     */
    public function store(${names.pascal}Request $request): JsonResponse
    {
        $item = $this->${names.camel}Service->create($request->validated());

        return response()->json([
            'status' => 'success',
            'message' => '${names.pascal} created successfully.',
            'data' => $item,
        ], 201);
    }

    /**
     * Update the specified ${names.pascal} in storage.
     */
    public function update(${names.pascal}Request $request, int $id): JsonResponse
    {
        $item = $this->${names.camel}Service->update($id, $request->validated());

        return response()->json([
            'status' => 'success',
            'message' => '${names.pascal} updated successfully.',
            'data' => $item,
        ]);
    }

    /**
     * Remove the specified ${names.pascal} from storage.
     */
    public function destroy(int $id): JsonResponse
    {
        $this->${names.camel}Service->delete($id);

        return response()->json([
            'status' => 'success',
            'message' => '${names.pascal} deleted successfully.',
        ]);
    }
}
`;
}

export function laravelServiceTemplate(
  names: NamingVariations,
  options: {
    namespace?: string;
    modelNamespace?: string;
  } = {}
): string {
  const namespace = options.namespace || 'App\\Services';
  const modelNamespace = options.modelNamespace || 'App\\Models';

  return `<?php

namespace ${namespace};

use ${modelNamespace}\\${names.pascal};
use Illuminate\\Database\\Eloquent\\Collection;

class ${names.pascal}Service
{
    /**
     * Retrieve all ${names.pluralPascal}.
     */
    public function getAll(array $filters = []): Collection
    {
        return ${names.pascal}::query()
            ->latest()
            ->get();
    }

    /**
     * Find ${names.pascal} by primary key.
     */
    public function getById(int $id): ${names.pascal}
    {
        return ${names.pascal}::findOrFail($id);
    }

    /**
     * Create a new ${names.pascal}.
     */
    public function create(array $data): ${names.pascal}
    {
        return ${names.pascal}::create($data);
    }

    /**
     * Update an existing ${names.pascal}.
     */
    public function update(int $id, array $data): ${names.pascal}
    {
        $item = $this->getById($id);
        $item->update($data);

        return $item;
    }

    /**
     * Delete a ${names.pascal}.
     */
    public function delete(int $id): bool
    {
        $item = $this->getById($id);

        return (bool) $item->delete();
    }
}
`;
}

export function laravelActionTemplate(
  names: NamingVariations,
  options: {
    namespace?: string;
    modelNamespace?: string;
  } = {}
): string {
  const namespace = options.namespace || 'App\\Actions';
  const modelNamespace = options.modelNamespace || 'App\\Models';

  return `<?php

namespace ${namespace};

use ${modelNamespace}\\${names.pascal};

class Create${names.pascal}Action
{
    /**
     * Execute the ${names.pascal} creation workflow.
     */
    public function execute(array $data): ${names.pascal}
    {
        return ${names.pascal}::create($data);
    }
}
`;
}

export function laravelRequestTemplate(names: NamingVariations, namespace: string = 'App\\Http\\Requests'): string {
  return `<?php

namespace ${namespace};

use Illuminate\\Foundation\\Http\\FormRequest;

class ${names.pascal}Request extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, list<string>>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'status' => ['nullable', 'string', 'in:draft,active,archived'],
            'metadata' => ['nullable', 'array'],
        ];
    }

    /**
     * Get custom error messages for validation rules.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'The ${names.camel} name field is required.',
        ];
    }
}
`;
}

export function laravelMigrationTemplate(names: NamingVariations): string {
  return `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('${names.pluralSnake}', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('status')->default('draft');
            $table->json('metadata')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('${names.pluralSnake}');
    }
};
`;
}
