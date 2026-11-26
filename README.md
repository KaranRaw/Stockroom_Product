# Stockroom · Product Management System

A full-stack product inventory application for managing products, stock quantities, prices, and categories.

**FastAPI · React + TypeScript · PostgreSQL · SQLAlchemy · Alembic**

For installation and startup commands, see [START-HERE.md](START-HERE.md).

Manage products through a responsive catalog: add, view, edit, confirm deletion, search by name, and paginate results. The overview shows product count, total units, inventory value, and low-stock products.

## Video walkthrough

[Watch the product management walkthrough](docs/demos/stockroom_ui_walkthrough.webm).

The video demonstrates the frontend using deterministic API fixtures. See [recording instructions](docs/demos/README.md) to regenerate it or record the real FastAPI/PostgreSQL lifecycle.

## Automated checks

GitHub Actions runs backend linting, migrations, PostgreSQL integration tests, frontend unit tests, a production build, fixture-based UI tests, and a real PostgreSQL/FastAPI/browser lifecycle on pushes and pull requests. See [testing and verification](docs/VERIFICATION.md) for commands and coverage.

## Features

- Product list, details, creation, full replacement (PUT), partial edits (PATCH), and confirmed soft deletion.
- Shared persistent categories with searchable Add/Edit dropdowns, inline creation, keyboard selection, and reuse after refresh. Category count is unlimited; each name is limited to 100 characters.
- Optional HTTPS image URLs with previews, removal, loading states, and broken-image fallbacks.
- Case-insensitive, literal substring search by product name; 300 ms debounce.
- Server-side pagination, newest first with a stable ID tie-breaker.
- Client, API, and database validation; form values survive 422/network/server errors.
- Exact decimal storage for INR prices.
- Loading, empty, no-results, request-error, and retry states.
- Accessible native dialogs with focus restoration, keyboard support, and labeled controls.
- API documentation at `http://localhost:8000/docs`.
- Versioned migrations, optional sample data, API examples, and automated tests.

## Requirements

- Python 3.10+ (3.12 recommended)
- Node.js 22.12+ (22 LTS or 24 LTS)
- PostgreSQL 15+ locally, or a Neon/Supabase PostgreSQL database
- Docker only if you choose the optional container setup

No local database installation is needed when using a hosted PostgreSQL provider. For local development, use PostgreSQL directly or the optional Docker setup below.

## Quick start with Neon or Supabase

### 1. Configure PostgreSQL

Create a development database in your provider dashboard. Copy its **direct PostgreSQL connection string**. Use a session pooler only if direct connectivity is unavailable; avoid transaction-pooler endpoints for migrations.

Create `backend/.env` from `backend/.env.example` and set:

```dotenv
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
CORS_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173"]
```

Replace the example values with provider credentials. URL-encode special characters in the username/password. This application uses PostgreSQL directly through SQLAlchemy; a Supabase project URL or API key is not a database connection string.

The migration enables `pg_trgm`. If your application role cannot enable extensions, enable `pg_trgm` using your provider's SQL editor/admin role before running the migration.

### 2. Start the backend

Windows PowerShell, from the project root:

```powershell
cd backend
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\alembic.exe upgrade head
.\.venv\Scripts\python.exe -m app.seed
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

macOS/Linux:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Seeding is optional. It adds 30 demo products, each with an HTTPS image URL, only when the entire product table is empty (including soft-deleted records). Repeating the command skips existing data without overwriting products or reviving deleted rows. Categories and products are inserted in one transaction, and concurrent seed commands are serialized. Nothing is seeded automatically during application startup. See [seed data](docs/SEED-DATA.md).

Check `http://localhost:8000/api/health`; a successful response verifies an actual database connection. Open `http://localhost:8000/docs` to exercise the API.

### 3. Start the frontend

In a second terminal:

```powershell
cd frontend
npm ci
npm run dev
```

PowerShell may require `npm.cmd` instead of `npm` depending on execution policy.

Open **http://127.0.0.1:5173**. Vite forwards `/api` requests to the backend at port 8000. To use a backend on another host, copy `frontend/.env.example` to `frontend/.env`, set `VITE_API_BASE_URL`, and include the frontend origin in backend `CORS_ORIGINS`.

Frontend-only startup displays an honest connection error when the backend is unavailable. There is no hidden demo-mode database.

## Optional Docker setup

With Docker installed:

```bash
docker compose up --build
```

Open **http://localhost:8080** and API docs at **http://localhost:8000/docs**. Compose starts PostgreSQL, waits for health checks, runs Alembic, then serves the backend and frontend.

To add demo products:

```bash
docker compose exec backend python -m app.seed
```

`docker compose down` stops services while retaining data. The included credentials are for local development. If setting `POSTGRES_PASSWORD`, use a URL-safe password or update the backend connection URL with its URL-encoded value.

## Tests

### Backend validation tests

From `backend`, with the virtual environment active:

```bash
pytest -q tests/test_schemas.py
ruff check .
```

### PostgreSQL integration tests

Use a **separate, empty test database**, not your application database. Its database name must contain `test`; the fixture refuses other names.

PowerShell:

```powershell
$env:TEST_DATABASE_URL = 'postgresql+psycopg://USER:PASSWORD@HOST:5432/inventory_test?sslmode=require'
.\.venv\Scripts\python.exe -m pytest -q
```

macOS/Linux:

```bash
TEST_DATABASE_URL='postgresql+psycopg://USER:PASSWORD@HOST:5432/inventory_test?sslmode=require' pytest -q
```

The suite applies migrations, then isolates each test in a transaction with savepoints. Application commits do not retain test products. Tests cover CRUD, missing records, update validation, decimal arithmetic, search escaping, pagination, stats, and direct database constraint violations.

Without `TEST_DATABASE_URL`, integration tests are explicitly **skipped**. Schema-validation tests can still run. Use the connection string for a dedicated test database/branch when using Neon or Supabase; do not rename your production database merely to pass the guard.

### Frontend tests

From `frontend`:

```bash
npm test
npm run build
npx playwright install chromium
npm run test:ui
```

You can use an existing Edge installation instead of downloading Chromium:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm run test:ui
```

Browser UI tests intercept HTTP requests with deterministic fixtures. They verify frontend behavior and generate screenshots; they do not test FastAPI or PostgreSQL.

### Real full-stack browser test

Start FastAPI against your development database, then from `frontend`:

```powershell
$env:RUN_LIVE_E2E = '1'
npm run test:live
```

The opt-in test creates, searches, views, edits, and deletes a uniquely named product through the UI, using the real backend. It attempts cleanup if a step fails. Do not run it against a production database.

The GitHub Actions workflow runs Python checks, PostgreSQL integration tests, migration reversal/reapplication, frontend tests/build, and fixture-based browser tests.

## API contract

Base path: `/api`. This version provides single-user product management without built-in authentication.

- `GET /categories` → **200**, persistent shared category choices.
- `POST /categories` → **201** for a new name or **200** when an existing category is reused.
- `GET /products?search=lamp&page=1&page_size=10` → **200**, paginated products.
- `GET /products/{id}` → **200**, one product; **404** if missing.
- `POST /products` → **201**, created product plus `Location` header.
- `PUT /products/{id}` → **200**, updated product; **404** if missing.
- `PATCH /products/{id}` → **200**, partial update; omitted fields stay unchanged.
- `DELETE /products/{id}` → **204**, marks the row deleted without removing it; **404** if missing or already deleted.
- `GET /products/stats` → **200**, whole-inventory aggregates.
- `GET /health` → **200** only after a database query succeeds.

A create/update body:

```json
{
  "name": "Adjustable desk lamp",
  "description": "Dimmable warm LED light",
  "price": "149.90",
  "quantity": 4,
  "category": "Workspace",
  "image_url": "https://example-bucket.s3.amazonaws.com/lamp.jpg"
}
```

An individual response adds `id` and `created_at`:

```json
{
  "id": 1,
  "name": "Adjustable desk lamp",
  "description": "Dimmable warm LED light",
  "price": "149.90",
  "quantity": 4,
  "category": "Workspace",
  "image_url": "https://example-bucket.s3.amazonaws.com/lamp.jpg",
  "created_at": "2026-11-20T10:00:00Z"
}
```

Price is serialized as a decimal string. Timestamps represent UTC instants and may use `Z` or `+00:00`. The UI displays dates in the viewer's local timezone.

List responses contain `items`, `total`, `page`, and `page_size`. The default page size is 10, maximum 100. Pages start at 1; an out-of-range page returns an empty `items` array with the actual total.

Errors share this structure:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please check the submitted fields.",
    "details": [{"field": "price", "message": "Input should be greater than or equal to 0"}]
  }
}
```

Invalid input → **422**; unknown product → **404**; unavailable/failed database operation → **503**; unexpected exception → **500**. Internal exception details are logged, not returned to clients.

`PUT` replaces editable fields. Name, price, and quantity are required; omitted optional description/category values become null. IDs, creation dates, and the internal deletion flag cannot be set through product requests; extra fields are rejected. PATCH accepts only changed fields; explicit null clears optional fields. Empty PATCH objects are rejected. See [image, PATCH and search notes](docs/IMAGE-AND-PATCH.md).

See [request examples](docs/api.http) for executable HTTP examples.

## Soft deletion and clean database initialization

Products have an internal `is_deleted BOOLEAN NOT NULL DEFAULT FALSE` flag. DELETE atomically changes it to true; it never removes the product row. Deleted products return 404 for reads and updates and are excluded from search, page totals, stock counts, inventory value, and low-stock counts. After server confirmation, the UI immediately removes the row and updates cached totals while fresh data loads in the background. Repeated DELETE returns 404. There is no hard-delete or restore endpoint.

The existing `0001` migration now creates the flag and active-only indexes from the start. `0002` adds the image URL, and `0003` adds the shared category registry and backfills product category associations. A clean database applies all three revisions with:

```bash
alembic upgrade head
alembic check
```

Use an empty database/schema with no previous Alembic revision state for this clean initialization. Changing an already-applied migration file does not cause Alembic to replay it. The reference SQL schema is also a transactional, first-time schema definition; use either that reference or Alembic, not both on the same schema.

## Database and architecture

- The [initial migration](backend/migrations/versions/0001_create_products.py), [image migration](backend/migrations/versions/0002_product_image_url.py), and [shared-category migration](backend/migrations/versions/0003_shared_categories.py) are the authoritative schema history.
- [SQL script](database/schema.sql) is a readable equivalent; do not apply it in addition to Alembic.
- [Architecture and decisions](docs/ARCHITECTURE.md) explains layers, indexes, transactions, and assumptions.
- No automatic `create_all`: schema changes are versioned and reviewed.
- Categories are persistent records linked through category_id; the product API retains its category-name contract. See [shared categories](docs/CATEGORIES.md).
- No repository abstraction over SQLAlchemy: the small service layer keeps queries visible.

## Screenshots

Screenshots are generated by browser tests using deterministic API fixtures and local product illustrations, not a live PostgreSQL connection.

### Product catalog

![Product catalog](docs/screenshots/products-desktop.png)

### Add a product with an image

![Product form](docs/screenshots/product-form.png)

### View product details

![Product details](docs/screenshots/product-details.png)

### Edit and recover from validation errors

![Retained edit values after a validation failure](docs/screenshots/edit-validation-error.png)

### Confirm deletion

![Delete confirmation](docs/screenshots/delete-confirmation.png)

### Search products by name

![Product search](docs/screenshots/products-search.png)

### Search and create shared categories

![Searchable category choices](docs/screenshots/category-search-1440.png)

### Mobile catalog

![Mobile product catalog](docs/screenshots/products-mobile.png)

## Assumptions and limitations

- Single user; no authentication or authorization, as these were not requested. Public deployment would require access control.
- INR is the only currency. Price is 0–9,999,999,999.99, with at most two decimal places.
- Quantity is a whole number from 0 to 2,147,483,647.
- Duplicate product names are allowed. Names are trimmed and must contain 1–200 characters.
- Description (5,000 characters), category (100 characters), and HTTPS image URL (2,048 characters) are optional; blank values become null. Images must be browser-readable; this project does not upload files or fetch image URLs on the backend.
- Low stock means quantity ≤ 5 and includes out-of-stock products.
- Concurrent edits use last-write-wins; there is no stock reservation or order workflow.
- Offset pagination supports a straightforward paginated catalog. Short searches and exact counts may scan more rows; there are no benchmark claims.
- PostgreSQL integration tests require a dedicated test database. Standard browser UI tests use mocked API responses; the separate live end-to-end test requires a running backend and development database.

## Deployment

Set backend environment variables for the target PostgreSQL database and allowed frontend origins. Apply migrations with `alembic upgrade head` before starting the API. Build the frontend with `npm ci` and `npm run build`; the optional Docker configuration serves the frontend through Nginx and forwards `/api` to FastAPI.

The application has no built-in authentication. Restrict network access or place an authenticated gateway in front of it when deploying to a shared environment. Keep database credentials in environment variables or an untracked `.env` file.

## Development workflow

Run the checks in [testing and verification](docs/VERIFICATION.md) before pushing changes. GitHub Actions runs the same backend and frontend checks on pushes and pull requests. UI tests use explicit `main` or sidebar scopes when both areas provide the same action.
