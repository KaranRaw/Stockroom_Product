# Testing and verification

## Continuous integration

GitHub Actions runs on each push and pull request. The workflow uses Python 3.12, Node.js 22, and a temporary PostgreSQL 17 service.

The backend job installs development dependencies, runs Ruff, applies and checks Alembic migrations, executes the PostgreSQL test suite, and verifies that migrations can be rolled back and reapplied.

The frontend job installs the locked npm dependencies, runs unit tests, builds the production bundle, and runs the Playwright UI suite. The UI test report is uploaded as a workflow artifact.

The full-stack job creates a separate PostgreSQL service, applies clean migrations, starts FastAPI and Vite through Playwright, and runs the real browser lifecycle. It also verifies that soft-deleted products cannot be read, updated, deleted again, or returned by search.

## Coverage

Backend tests cover request validation and error responses, CRUD operations, full replacement with PUT, partial updates with PATCH, missing records, decimal prices, escaped case-insensitive search, pagination, database constraints, and migration/index behavior. Soft-delete regressions verify row retention, hidden records across reads/search/totals, blocked updates, repeated deletion, flag ownership, a default-false non-null flag, and active-row indexes. Category regressions cover shared identity, duplicate normalization, optional foreign keys, persistence without products, and legacy-data migration round trips.

Frontend unit and UI tests cover form validation, API errors, create/view/edit/delete flows, deletion confirmation, pagination, empty and no-results states, image preview and fallback behavior, and mobile form use. Confirmed-delete regressions cover immediate row/total updates before delayed refreshes, last-page correction, aborted stale reads, and response ordering that must not decrement totals twice. Layout regressions also cover sidebar collapse/expand actions, notification alignment, tablet/mobile transitions, and the sticky top bar. Category dropdown tests cover Add/Edit reuse after refresh, implicit and explicit category creation, duplicate handling, load/save retries, draft retention, and mobile widths with long names. Browser UI tests use deterministic API fixtures; they do not connect to FastAPI or PostgreSQL.

The screenshots in `docs/screenshots` show fixture-based UI states with animations disabled for stable captures. The opt-in live browser test exercises the UI against a running backend and development database.

## Run locally

### Backend

From `backend`, activate the project virtual environment and run:

```powershell
ruff check .
alembic check
pytest -q
```

The PostgreSQL integration suite uses `TEST_DATABASE_URL` pointing to a separate empty test database whose name contains `test`. Without that variable, integration cases are skipped. For example:

```powershell
$env:TEST_DATABASE_URL = 'postgresql+psycopg://USER:PASSWORD@HOST:5432/inventory_test?sslmode=require'
pytest -q
```

### Frontend

From `frontend`, run:

```powershell
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:ui
```

To use an installed Microsoft Edge browser instead of downloading Chromium:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm run test:ui
```

### Live full-stack browser test

Start the backend with a development database. From `frontend`, run:

```powershell
$env:RUN_LIVE_E2E = '1'
npm run test:live
```

The live test creates, searches, views, edits, and deletes a uniquely named product. Use a development database, never a production database.

Migration reversal drops database objects and data. Use only a disposable test database for rollback checks.

Category search browser checks cover case-insensitive partial matches in Add/Edit, large shared registries without per-keystroke API requests, keyboard selection, Escape/Tab dismissal, retained selection, no-match creation/clearing, and bounded result-list spacing at 390px, 768px, and 1440px widths.

## Video walkthrough

`npm run demo` records an assertion-checked frontend walkthrough using the shared browser-test fixtures. Successful output is saved in `docs/demos/stockroom_ui_walkthrough.webm`. The live test can also record video with `RECORD_VIDEO=1`; its output remains in `frontend/test-results`. See [recording instructions](demos/README.md) for commands and the distinction between UI evidence and backend/database verification.

Seed checks cover the bundled 30-product dataset, HTTPS image values, shared categories, repeat execution, preservation of existing/deleted data, transactional rollback, and seeded API operations. A browser regression exercises the same 30-row catalog with local image fixtures. CI runs the seed command twice against its disposable PostgreSQL service. See [seed data](SEED-DATA.md).
