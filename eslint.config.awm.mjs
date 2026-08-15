// AWM ESLint config — extiende la configuración del proyecto con reglas cuyos
// mensajes son legibles para un LLM (flat config, ESLint v9+).
// Uso: npx eslint . --config eslint.config.awm.mjs --format json
//
// `awm sensors init` copia este archivo a la raíz del proyecto, así que la
// configuración del proyecto vive junto a él. Heredarla no es un extra: sin sus
// `ignores` el sensor lintea `dist/`, `build/` y `coverage/`, y devuelve cientos
// de hallazgos sobre código generado mientras el código fuente pasa limpio.
//
// DOS INVARIANTES QUE ESTE ARCHIVO NO PUEDE ROMPER, porque el consumidor es el
// runner de sensores y no una persona (`cli/src/commands/sensors/run.js`):
//
//  1. NADA se escribe en stderr. Cuando ESLint sale con código != 0 —el caso
//     normal cuando hay hallazgos— el runner concatena `stdout + stderr` y le
//     pasa el resultado a `JSON.parse`. Una sola línea de aviso rompe el parseo,
//     el formateador devuelve `[]`, y un repo con errores reales de lint se
//     reporta como si no tuviera ninguno.
//  2. Nunca se lanza por una configuración que ESLint sí sabría cargar. Un throw
//     aquí no produce un sensor en rojo: produce `status: "skipped"`, que no
//     rompe el `overall`. Matar el sensor es la forma más callada de fallar.
//
// Por eso, cuando no se puede heredar, se degrada con `ignores` conservadores en
// vez de avisar o morir. Solo se lanza ante una configuración que está rota de
// verdad — una que el propio `eslint` del proyecto tampoco podría cargar.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import globals from 'globals';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

// Los nombres de flat config que este archivo puede importar con Node, en el
// mismo orden de resolución de ESLint. Fijar uno solo dejaba sin heredar nada a
// cualquier proyecto que usara otro.
const INHERITABLE_CONFIGS = ['eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs'];

// `eslint.config.ts`, `.mts` y `.cts` quedan deliberadamente fuera de esa lista:
// ESLint los carga con jiti desde v9.18, pero un `import()` de Node no puede.
// Que el proyecto use uno no es un error suyo, así que se degrada, no se lanza.
//
// Se usan SOLO cuando no hay configuración que heredar. No pisan nada: si el
// proyecto tiene la suya, mandan sus `ignores` y estos no se aplican.
const FALLBACK_IGNORES = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/out/**',
  '**/coverage/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/.svelte-kit/**',
  '**/.output/**',
  '**/.turbo/**',
  '**/*.min.js',
];

const exists = (name) => fs.existsSync(path.join(projectRoot, name));
const inheritableConfig = INHERITABLE_CONFIGS.find(exists);

let projectConfig;

if (inheritableConfig === undefined) {
  // O el proyecto no tiene configuración, o la tiene en TypeScript y este
  // archivo no puede cargarla. En ambos casos el sensor sigue corriendo: sin los
  // `ignores` del proyecto, al menos no recorre los directorios generados.
  projectConfig = [{ name: 'awm/fallback-ignores', ignores: FALLBACK_IGNORES }];
} else {
  const configPath = path.join(projectRoot, inheritableConfig);
  let projectModule;
  try {
    projectModule = await import(pathToFileURL(configPath).href);
  } catch (error) {
    // Esta sí está rota: es un nombre que ESLint también importa, así que el
    // `eslint` del propio proyecto fallaría igual. Tragárselo dejaba al sensor
    // corriendo sin `ignores` y sin que nada indicara por qué.
    throw new Error(
      `[awm] ${inheritableConfig} existe pero no se pudo cargar: ${error.message}`,
      { cause: error },
    );
  }

  const exported = projectModule.default;
  if (exported === undefined || exported === null) {
    throw new Error(
      `[awm] ${inheritableConfig} no tiene \`export default\`: ESLint v9 espera el ` +
        `flat config como export por defecto.`,
    );
  }

  // `tseslint.config(...)` y los presets devuelven arrays anidados.
  projectConfig = Array.isArray(exported) ? exported.flat(Infinity) : [exported];
}

export default [
  ...projectConfig,
  {
    // Este archivo lo genera AWM, no el proyecto. Un hallazgo sobre él es ruido
    // que su autor no puede accionar desde su repo.
    ignores: ['eslint.config.awm.mjs'],
  },
  {
    // Vale en cualquier lenguaje que ESLint parsee: no hay falsos positivos de
    // código inalcanzable en TypeScript.
    rules: { 'no-unreachable': 'error' },
  },
  {
    // Estas dos, en cambio, solo tienen sentido en JavaScript. En TypeScript son
    // falsos positivos estructurales: `no-undef` no ve los tipos ambientales
    // (`NodeJS.Timeout`, el namespace `React`) porque no existen en tiempo de
    // ejecución, y `no-unused-vars` marca como no usados los nombres de
    // parámetro de una firma dentro de una interfaz. typescript-eslint documenta
    // desactivar ambas en `.ts` por esa razón — y un bloque sin `files` se
    // aplicaba al final y volvía a encenderlas por encima del proyecto.
    //
    // En TypeScript manda la configuración del proyecto y `tsc`, que es el
    // sensor `typecheck` y sí sabe de tipos.
    files: ['**/*.js', '**/*.jsx', '**/*.mjs', '**/*.cjs'],
    languageOptions: {
      globals: {
        ...globals.es2024,
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      // `_`-prefixed args/vars are intentionally unused (callback signatures,
      // destructure-and-drop). This is the canonical ESLint convention.
      'no-unused-vars': [
        'error',
        {
          vars: 'all',
          args: 'after-used',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^[eE]$|^_',
        },
      ],
      'no-undef': 'error',
    },
  },
];
