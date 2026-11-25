# Testing and verification

## Continuous integration

GitHub Actions runs on each push and pull request. The workflow uses Python 3.12, Node.js 22, and a temporary PostgreSQL 17 service.

The backend job installs development dependencies, runs Ruff, applies and checks Alembic migrations, executes the PostgreSQL test suite, and verifies that migrations can be rolled back and reapplied.

The frontend job installs the locked npm dependencies, runs unit tests, builds the production bundle, and runs the Playwright UI suite. The UI test report is uploaded as a workflow artifact.

## Coverage

Backend tests cover request validation and error responses, CRUD operations, full replacement with PUT, partial updates with PATCH, missing records, decimal prices, escaped case-insensitive search, pagination, database constraints, and migration/index behavior.

Frontend unit and UI tests cover form validation, API errors, create/view/edit/delete flows, deletion confirmation, pagination, empty and no-results states, image preview and fallback behavior, and mobile form use. Browser UI tests use deterministic API fixtures; they do not connect to FastAPI or PostgreSQL.

The screenshots in `docs/screenshots` show fixture-based UI states. The opt-in live browser test exercises the UI against a running backend and development database.

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
