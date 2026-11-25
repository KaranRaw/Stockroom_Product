# Images, partial updates, and search

## Product images

Products have one optional `image_url` string (up to 2,048 characters). Use a publicly readable HTTPS image URL, for example an S3 object URL or CDN link. This is an image URL, not a product-page URL.

No upload service, S3 credentials, or image-proxy backend is needed. The backend validates and stores the URL; it never downloads or inspects the remote object. The browser renders it without a referrer. Missing, inaccessible, non-image, or expired links show a fallback. Presigned S3 URLs work until their expiry; a durable public/CDN URL is preferable for long-lived catalog records.

The form previews valid links, allows removal, and retains the URL after any failed save. Saving an image removal sends `{"image_url": null}`.

Migration `0002` adds the nullable column and its HTTPS check without rewriting existing product records. Run `alembic upgrade head` for new or existing databases. Do not edit a previously applied `0001` migration.

## PUT and PATCH

Both assignment-required PUT and partial-update PATCH are available at `/api/products/{id}`.

- PUT requires name, price and quantity; omitted optional fields are cleared.
- PATCH accepts only changed fields; omitted fields remain unchanged.
- Null clears optional description/category/image_url.
- Explicit null for name/price/quantity is rejected.
- Empty PATCH objects and read-only/unknown fields are rejected with 422.
- All supplied fields are validated before any database write. An invalid PATCH is atomic.
- Both return 200 with the complete updated product; missing IDs return 404.

Example:

```http
PATCH /api/products/1
Content-Type: application/json

{"quantity": 8, "description": "Updated description"}
```

The React edit form compares normalized original/current values and sends only actual changes. Decimal display differences such as 149.9 versus 149.90 do not produce false edits. Save is disabled when nothing changed. 422 field errors appear next to their controls; global request errors appear in the same dialog, with entered values intact. There is no automatic reset or modal close on failure.

## Search performance

The database migration creates `ix_products_name_trgm`, a PostgreSQL GIN index using `pg_trgm` and `gin_trgm_ops`. This is appropriate for the case-insensitive substring query `name ILIKE '%term%'`; an ordinary name B-tree index is not a substitute for arbitrary substring matching.

The API escapes LIKE metacharacters and binds parameters. It counts matches separately and fetches only the requested page. The composite `created_at DESC, id DESC` B-tree index supports deterministic newest-first pagination.

The PostgreSQL planner decides whether to use an index. Tiny datasets, very short search strings, and broad matches may still use sequential scans. No latency benchmark is claimed.

The React search has a 300 ms debounce: typing resets the timer, and only a pause updates the query key. The browser regression test measures requests and confirms that rapid keystrokes produce one search request. Results for different search terms/pages use separate query keys.

## UI verification

Browser tests use deterministic API fixtures and local product illustrations. They cover real rendered UI behavior, not FastAPI/PostgreSQL connectivity. Run the opt-in live test against a development database and the PostgreSQL integration suite against a separate test database to verify backend connectivity and behavior.
