# Walkthrough recordings

## Frontend walkthrough

[Watch the product management walkthrough](stockroom_ui_walkthrough.webm).

The recording shows the actual React application using the same deterministic API fixtures as the browser UI suite. It demonstrates catalog browsing, name search, product details, client validation, adding an image, creating a shared category, product creation, partial edits, category search/reuse after refresh, and deletion confirmation.

This is frontend behavior evidence. It does not establish that FastAPI, PostgreSQL, or migrations passed integration tests. The walkthrough publishes its video only after every assertion succeeds.

### Regenerate

From `frontend`, with frontend packages installed:

```powershell
npx playwright install chromium ffmpeg
npm run demo
```

For an already installed Microsoft Edge browser:

```powershell
npx playwright install ffmpeg
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm run demo
```

The successful recording is saved to `docs/demos/stockroom_ui_walkthrough.webm`. Test working files remain in ignored `frontend/test-results`. No backend or database is used in this mode.

## Record the real backend lifecycle

Start the backend with migrations applied to a development or dedicated test database. From `frontend`:

```powershell
$env:RUN_LIVE_E2E = '1'
$env:RECORD_VIDEO = '1'
npm run test:live -- --headed
```

The live test uses FastAPI/PostgreSQL and creates a uniquely named product and category. It confirms the product is hidden after soft deletion and that its category is still reusable after refresh. Product cleanup is attempted when a step fails; created categories remain in the shared registry. Use an isolated development/test database.

Recordings are written beneath `frontend/test-results`. With RECORD_VIDEO unset, ordinary live tests keep their previous recording behavior: video is off and failure traces are retained.

## README playback

The root README links to the checked-in WebM recording. Open or download the file in a browser that supports WebM. To show an inline video player on GitHub, upload the recording through GitHub's attachment interface and replace the README link with the resulting attachment URL.
