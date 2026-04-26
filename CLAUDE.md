# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Kontra.js is a lightweight HTML5 game micro-library optimized for the js13kGames competition (13KB zipped budget). Size is a first-class constraint — API design, code style, and the build pipeline all exist to minimize bytes.

## Common commands

- `npm test` — single-run Karma/Mocha/Chai unit + integration tests in ChromeHeadless. Coverage is enforced at 95% (statements/branches/functions/lines) via `karma-coverage`.
- `npm run test:watch` — Karma in watch mode.
- `npm run test:debug` — Karma in real Chrome for debugging (see `karma.conf.js`, triggered by `--debug`).
- `npm run test:ts` — type-checks `test/typings/*.ts` against `kontra.d.ts` without emitting. Run this after changing any JSDoc types.
- `npm run test:permutations` — long-running CI-only job that rebuilds + tests every combination of preprocessor feature flags (see "Feature-flag preprocessor" below). Run before PRs that touch `@ifdef`-gated code. Pass an option name to scope it: `node test/permutations gameObject`.
- `npm run eslint` — lint `src/` and `test/`. The config enforces byte-saving rules (see "Code style").
- `npm run build` — rollup → `kontra.js` (IIFE) + `kontra.mjs` (ESM), rebuild docs, rebuild `kontra.d.ts`.
- `npm run dist` — `build` + preprocess + terser → `kontra.min.js` / `kontra.min.mjs` with gzip size reporting.
- `npm run watch` — rebuild + dist on `src/*.js` changes.
- `npm start` — serve over HTTPS (uses `cert.pem`/`key.pem`) for manually loading examples.

Running a single test: Karma has no built-in file filter, so use Mocha's `describe.only` / `it.only` in the spec (eslint's `mocha-no-only` rule will block commits that leave them in). For permutation runs, pass the option name as shown above.

## Architecture

### Module layout
Everything lives in `src/` as flat ES modules, one file per concept (`sprite.js`, `pool.js`, `tileEngine.js`, `quadtree.js`, `gameLoop.js`, `assets.js`, `keyboard.js`, `pointer.js`, `gamepad.js`, `gesture.js`, `vector.js`, `helpers.js`, `events.js`, `core.js`, `plugin.js`, etc.). No subdirectories, no barrel folders.

### Two entry points (intentional, don't conflate)
- `src/kontra.js` — named ESM re-exports. This is the tree-shakeable entry used by `kontra.mjs`.
- `src/kontra.defaults.js` — imports everything and assigns to a single `kontra` object. This is the IIFE entry used by `kontra.js` (the built file, not the source). js13k users include the IIFE build and access APIs via `kontra.Sprite` etc.

Any new public export must be added to **both** files and covered in `test/unit/kontra.spec.js` / `test/unit/kontra.defaults.spec.js`.

### Class hierarchy
`Updatable` → `GameObject` → `Sprite` (and `Text`, `Button`). `GameObject` holds position/rotation/anchor/children/world-transform. `Sprite` adds image + animation rendering. Most renderable things should extend one of these rather than reinventing the lifecycle.

Each class is exported twice: once as a factory (`Sprite(props)`, default export) and once as the class itself (`SpriteClass`, named export). Factories are what games call; `*Class` is what subclasses extend.

### Feature-flag preprocessor
Source files contain `// @ifdef FEATURE_NAME` / `// @endif` blocks. The `dist` pipeline (`gulp-preprocess` in `gulpfile.js`) strips disabled features so game authors can compile a minimal subset. The full flag list is the `context` object in `gulpfile.js` (`GAMEOBJECT_*`, `SPRITE_*`, `TEXT_*`, `TILEENGINE_*`, `VECTOR_*`). When you add code behind a flag:
- Wrap the source in `@ifdef`/`@endif` (including parameter destructuring if the param is flag-gated — see `src/sprite.js` for the pattern).
- In the corresponding spec, guard assertions with `if (testContext.FEATURE_NAME)`. The `testContext` block between `// test-context:start` and `// test-context:end` is rewritten by `test/permutations/index.js` to toggle flags across all 2^N combinations.
- Run `npm run test:permutations <option>` before shipping.

### Docs + TypeScript from one source
JSDoc-like comments in `src/*.js` drive **both** the HTML docs (LivingCSS, via `tasks/docs.js`) and `kontra.d.ts` (via `tasks/typescript.js`). The comment syntax is not strict JSDoc — types are written in TypeScript syntax inside `{...}` so the declaration file gets precise types while the docs render them as human-readable names. See `CONTRIBUTING.md` for the convention. After any API or JSDoc change, run `npm run build` and `npm run test:ts`.

### Tests
- `test/unit/*.spec.js` — per-module unit tests, one file per `src/` module.
- `test/integration/*.spec.js` — cross-module behavior.
- `test/setup.js` — loaded as a module by Karma; creates a fresh `#mainCanvas`, calls `init()` before each test, and calls the `_reset` helpers (exported privately by `core.js`, `assets.js`, `events.js`, `gesture.js`, `random.js`) after each. If you add module-level mutable state to a new `src/` file, export a `_reset` and wire it into `setup.js`.
- `test/typings/*.ts` — compile-only checks that the public API is usable from TypeScript with expected types.

## Code style (byte-saving, enforced by ESLint)

The library intentionally breaks common JS conventions to shave bytes. These are enforced by `.eslintrc.js` in `src/` but **relaxed in `test/`** — don't propagate them into tests.

- `==` / `!=` over `===` / `!==`
- `let` over `const` (yes, even for constants)
- `| 0` over `Math.floor(...)`
- `.map()` over `.forEach()` (even when the return value is discarded)
- `2 ** n` over `Math.pow`
- One `let` declaration per scope for uninitialized vars (`one-var` with `uninitialized: 'always'`)
- Max line length 70 for comments (JSDoc blocks and `@ifdef` comments are exempted by pattern)

See the `140bytes` byte-saving wiki linked from `CONTRIBUTING.md` for the broader philosophy. When in doubt, pick the shorter form.

## Features out of scope
Per `CONTRIBUTING.md`, the library explicitly will not add: physics engine, math helpers beyond what's in `helpers.js`/`vector.js`, or linear-transform utilities. Don't add them — suggest they live in user code.

## Commit hooks
`husky` runs `lint-staged` on commit: `prettier --write` then `eslint --fix` on staged `*.js`. If a commit fails, fix the underlying issue — never bypass with `--no-verify`.
