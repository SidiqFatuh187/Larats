import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getNaming,
  laravelModelTemplate,
  laravelControllerTemplate,
  laravelServiceTemplate,
  laravelActionTemplate,
  laravelRequestTemplate,
  laravelMigrationTemplate,
} from '../src/templates/laravel.ts';

test('P0-1: Laravel templates preserve backslashes in Illuminate namespace imports', () => {
  const names = getNaming('Payment');
  const templates = [
    laravelModelTemplate(names),
    laravelControllerTemplate(names),
    laravelServiceTemplate(names),
    laravelActionTemplate(names),
    laravelRequestTemplate(names),
    laravelMigrationTemplate(names),
  ];

  for (const t of templates) {
    // There should NEVER be a mangled import like use IlluminateDatabase...
    assert.doesNotMatch(t, /use Illuminate[A-Z]/, 'Must not contain dropped backslash after Illuminate');
  }

  // Check specific imports
  assert.match(laravelModelTemplate(names), /use Illuminate\\Database\\Eloquent\\Factories\\HasFactory;/);
  assert.match(laravelModelTemplate(names), /use Illuminate\\Database\\Eloquent\\Model;/);
  assert.match(laravelControllerTemplate(names), /use Illuminate\\Http\\JsonResponse;/);
  assert.match(laravelControllerTemplate(names), /use Illuminate\\Http\\Request;/);
  assert.match(laravelServiceTemplate(names), /use Illuminate\\Database\\Eloquent\\Collection;/);
  assert.match(laravelRequestTemplate(names), /use Illuminate\\Foundation\\Http\\FormRequest;/);
  assert.match(laravelMigrationTemplate(names), /use Illuminate\\Database\\Migrations\\Migration;/);
  assert.match(laravelMigrationTemplate(names), /use Illuminate\\Database\\Schema\\Blueprint;/);
  assert.match(laravelMigrationTemplate(names), /use Illuminate\\Support\\Facades\\Schema;/);
});

test('P0-2: Modular Laravel controller imports base Controller class', () => {
  const names = getNaming('Payment');

  // Standard controller (in App\Http\Controllers)
  const standardCtrl = laravelControllerTemplate(names, {
    namespace: 'App\\Http\\Controllers',
  });
  assert.doesNotMatch(standardCtrl, /use App\\Http\\Controllers\\Controller;/);

  // Modular controller (e.g. in App\Modules\Payment\Controllers)
  const modularCtrl = laravelControllerTemplate(names, {
    namespace: 'App\\Modules\\Payment\\Controllers',
  });
  assert.match(modularCtrl, /use App\\Http\\Controllers\\Controller;/);
});
