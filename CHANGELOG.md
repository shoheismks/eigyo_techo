# Changelog

## [1.0.0-rc.4] - 2026-07-05

User manual and in-app help preparation.

### Added

- Added `docs/MANUAL.md` as the Markdown-based user operation manual.
- Added an in-app Help screen with quick guide sections.
- Added common `?` help entry points and visible Version display.

### Verification

- `npm.cmd run build` passes.

## [1.0.0-rc.3] - 2026-07-05

Version1.0 pre-release stabilization.

### Fixed

- Fixed the PC header global search path so the search keyword reaches the Customers list.

### Verified

- Input wiring for major forms was checked for `value` / `onChange` regressions.
- Supabase-first sync with LocalStorage fallback was reviewed.
- Storage upload flow keeps files in Supabase Storage and stores URL / metadata only.
- Chrome extension import route `/import?companyName=` returns HTTP 200 locally.
- Inventory, quote PDF, management dashboard, and customer karte imports/build paths were checked.
- `npm.cmd run build` passes.

## [1.0.0-rc.2] - 2026-07-03

Version1.0 trial operation preparation.

### Added

- Added `docs/TRIAL_OPERATION.md` for the first 1-2 weeks of real-world operation.
- Added operation checklists for pre-launch, daily checks, and weekly checks.
- Added known bugs list, improvement memo table, and feedback record table.
- Added Version1.0 operation procedure and stop-operation criteria.

### Changed

- Linked the trial operation guide from README.

### Verification

- `npm.cmd run build` passes.

## [1.0.0-rc.1] - 2026-07-03

Version1.0 Release Candidate.

### Added

- Supabase Auth login and user-scoped data handling.
- Supabase Database migration files for customers, products, contacts, suppliers, business cards, complaints, samples, quotes, adoptions, attachments, and mail drafts.
- Supabase Storage support for attachment metadata and public URLs.
- LocalStorage fallback for offline or missing Supabase configuration.
- Customer management, customer detail, and customer karte.
- Contacts, business cards, OCR preparation, and attachment metadata handling.
- Deal pipeline, status counts, follow dates, and pipeline memo management.
- Product master with product detail, pricing fields, gross margin calculation, attachments, and adoption history.
- Supplier management with domestic supplier and overseas manufacturer fields.
- Quote history, sample management, claim management, notifications, calendar, and analytics foundation.
- AI email, AI meeting prep, AI sales assistant, AI product proposal, meeting minutes, and LINE integration foundations with mock/fallback behavior.
- Chrome extension for importing a selected company name through `/import?companyName=`.
- PC sidebar layout and mobile 5-tab navigation.
- JSON Export / JSON Import backup and restore.
- Code splitting with React.lazy to keep Vite chunks below the warning threshold.

### Changed

- Reorganized source structure toward `modules/`, `shared/`, and `layouts/`.
- Split the large CSS file into shared style files.
- Reworked README for Version1.0 release candidate readiness.
- Added Supabase optimization migration for RLS, storage policy refresh, and user-scoped composite indexes.

### Security

- RLS policies use authenticated user ownership checks.
- Legacy anonymous full-access policy names are dropped by migration if present.
- Storage object operations are scoped to the authenticated user's folder.
- Secrets remain outside the repository through `.env` and Vercel environment variables.

### Verification

- `npm run build` passes.
- Vite 500kB chunk warning is resolved.

### Known Limitations

- OpenAI, Gmail, Outlook, LINE, and OCR integrations currently have mock/fallback foundations where full external API connection is not yet enabled.
- Supabase migration execution against production must be run from Supabase CLI or SQL Editor.
- Push notifications are not implemented; notifications are calculated on screen display.
