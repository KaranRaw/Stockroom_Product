# Quick Start

Install and run the Stockroom API and frontend.

## 1. Backend

Install Python 3.10+ (3.12 recommended). In a terminal:

```powershell
cd backend
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
Copy-Item .env.example .env
```

Open `backend/.env` and set your Neon/Supabase **PostgreSQL connection string**:

```dotenv
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
```

For a clean initialization, use an empty database/schema with no existing Alembic revision state. The initial migration includes `is_deleted BOOLEAN NOT NULL DEFAULT FALSE` and active-only search/order indexes. Revision 0003 adds shared categories, so apply migrations through head.

Then, still in `backend`:

```powershell
.\.venv\Scripts\alembic.exe upgrade head
.\.venv\Scripts\python.exe -m app.seed
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Open http://localhost:8000/api/health and http://localhost:8000/docs.

## 2. Frontend

Install Node.js 22.12+ (22 LTS or 24 LTS). In a second terminal:

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Open **http://127.0.0.1:5173**.

No application-code changes are needed for a normal database connection. No PostgreSQL installation is needed if you use Neon/Supabase.

## 3. Run the tests

Frontend: `npm.cmd test`, `npm.cmd run build`, and `npm.cmd run test:ui` (install Playwright Chromium first, or set `PLAYWRIGHT_CHANNEL=msedge` to use existing Edge).

Backend: from its virtual environment, `ruff check .`, `alembic check`, and `pytest -q`. Set `TEST_DATABASE_URL` to a **separate empty test database whose name contains test** to run integration cases; otherwise they are skipped.

With the real backend running, set `RUN_LIVE_E2E=1` and run `npm.cmd run test:live` from `frontend`.

See [README](README.md) for macOS/Linux commands, hosted-provider notes, Docker, the API contract, and full test instructions.

## Scope and assumptions

- The application provides single-user product management without built-in authentication.
- Browser UI tests use mocked API fixtures. Run the optional live end-to-end test to exercise the UI with a running backend and development database.
- Pushes and pull requests trigger the GitHub Actions workflow.

Product images are optional HTTPS links (including public/presigned S3 URLs). Edits use PATCH; PUT remains available in the API. See [image and API notes](docs/IMAGE-AND-PATCH.md).

The ZIP excludes installed dependencies, environments, database data, logs, reports, and credentials.

In Add or Edit, type in Category to search shared names, choose an existing result, or choose Custom category to create one. Save category persists it independently; saving a product with a new category also registers it. Names remain available after refresh. See [category behavior](docs/CATEGORIES.md).
