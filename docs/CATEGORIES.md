# Shared categories

Categories are persistent database records, not a hardcoded frontend list or browser-local setting. Both Add and Edit load the same registry through GET /api/categories. The selected value is linked to products using a nullable category_id foreign key.

## UI behavior

- Type in the searchable Category field to filter shared categories by any part of the name, ignoring case. Filtering uses the loaded registry without a request for each keystroke.
- Choose a matching category, or choose Custom category and enter a name. No category and Custom category remain available when there are no matches.
- The result list scrolls within a bounded area; there is no category count limit. Long names wrap inside the list and stay within the modal on small screens.
- Use Up/Down and Enter to choose a result. Escape dismisses the choices and retains the current category; Tab moves to the next form control. Unselected search text never changes the product category.
- Save category creates/reuses a shared record immediately, without requiring a product save.
- Saving a product with a custom name also registers it in the same transaction as the product.
- The dropdown selects the saved canonical name after creation.
- Categories remain available after refresh, product reassignment, or deletion of their last product.
- No category clears a product's association without deleting the shared category.
- Category load and save errors retain the product form and category draft. Both actions can be retried.
- Category creation does not save the other product fields. Canceling a product after explicitly saving a category keeps that category available.

Names are normalized by trimming and collapsing whitespace. A case-insensitive unique index prevents duplicate names. The first saved spelling is reused: Smartphone, smartphone and ' Smartphone ' identify one category. Category choices use database IDs internally, so a category name cannot collide with the Custom category control.

## API contract

GET /api/categories returns an alphabetically ordered array of objects containing id, name, and created_at.

POST /api/categories accepts:

```json
{"name": "Smartphone"}
```

A new category returns 201; a normalized duplicate returns 200 with the existing record. Blank names, names longer than 100 characters, nulls, and unknown fields return the common 422 error response.

Product POST/PUT/PATCH continue accepting a category name string or null. Product responses still return a category name string or null. No client changes to category_id are accepted. Product writes use an atomic category upsert, so concurrent creation of the same normalized name cannot produce duplicate records.

## Migration

Revision 0003 creates the categories table, seeds the five original choices, and backfills existing category text, including soft-deleted products. It then replaces products.category with category_id and adds the foreign key/index. Existing products keep their category association. Case/whitespace variants are consolidated into one canonical record.

Run `alembic upgrade head`. Clean installations apply all three revisions. Databases already using the current soft-delete baseline at 0002 can upgrade without clearing products. The existing revised 0001 soft-delete migration still requires a clean initialization if it was previously applied before that revision was amended.

Category records are retained independently of product soft deletion. There is no category delete endpoint. The foreign key uses RESTRICT to protect linked records.

Downgrading 0003 restores category names on products, then removes the category registry. Use disposable databases for migration reversal checks.

## Verification

Backend regressions cover persistence across requests, product reuse, duplicate identity, invalid writes, optional associations, foreign-key protection, soft-delete preservation, and a backfill/downgrade/upgrade round trip.

Browser regressions cover reuse in Add/Edit after refresh, implicit registration during a product save, standalone creation, duplicate requests, error recovery without lost inputs, searchable selection with large registries, keyboard navigation, no-match/clear behavior, and long names at mobile, tablet, and desktop widths. The real full-stack test exercises the registry through FastAPI/PostgreSQL in CI.
