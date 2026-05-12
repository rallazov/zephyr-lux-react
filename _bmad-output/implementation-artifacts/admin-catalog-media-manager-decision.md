# Admin Catalog And Media Manager Decision Note

Status: accepted

## Decision

Build the catalog and media manager inside the existing `/admin` React app in this repository. Keep Supabase as the catalog source of truth and use Supabase Storage bucket `product-images` for public product imagery.

## Rationale

- The repo already has protected admin auth, product CRUD, variants, pricing, stock, statuses, templates, and `product_images`.
- A separate admin app would duplicate auth, deployment, routing, and catalog data code before it improves the owner workflow.
- Product images are storefront assets, so they can be public. Shipment images remain private evidence photos with signed preview URLs.

## v1 Scope

- Product-first editor with upload, image previews, alt text, primary image, sort order, and optional variant assignment.
- Catalog manager list with thumbnails, search/filter, price, stock, status, and collection summaries.
- Collection assignments via `product_collection_assignments`; legacy `category` remains a storefront fallback.
- No image resizing/compression pipeline in v1; preserve uploaded quality with practical MIME and size limits.
