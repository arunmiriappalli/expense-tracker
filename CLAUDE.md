# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # start dev server (Turbopack)
npm run build    # production build
npm run lint     # ESLint
```

There is no test suite.

## Environment

Copy `.env.local.example` to `.env.local` and fill in:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Gmail sync (optional): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GMAIL_REDIRECT_URI`
- PDF passwords (optional, per bank/product): `PDF_PASSWORD_ICICI_BANK`, `PDF_PASSWORD_ICICI_CC`, `PDF_PASSWORD_ICICI_AMAZON_CC`, `PDF_PASSWORD_AXIS_BANK`, `PDF_PASSWORD_AXIS_MYZONE_CC`, `PDF_PASSWORD_AXIS_AIRTEL_CC`, `PDF_PASSWORD_UNION_BANK`, `PDF_PASSWORD_YES_CC`

Run `supabase/schema.sql` then `supabase/schema_settings.sql` in the Supabase SQL editor.

## Architecture

Single-table app. One Supabase table (`transactions`) stores all parsed bank/credit-card transactions for a household.

**Data flow for PDF upload:**
1. `POST /api/parse` receives the PDF via `FormData`
2. `pdfjs-dist` (server-side, via `serverExternalPackages`) extracts raw text
3. `src/lib/parsers/index.ts` calls `detectSource()` to identify the bank by text heuristics, then routes to the appropriate parser
4. Each parser in `src/lib/parsers/` emits `ParsedTransaction[]` — date, description, amount, debit/credit type
5. `src/lib/categorize.ts` assigns a category via regex rules
6. Rows are upserted to Supabase; duplicates are silently ignored via the unique constraint on `(date, amount, description, source)`

**Statement month/year** is derived from the latest transaction date in the batch — not the filename.

**Supported sources** (`StatementSource` in `src/types/index.ts`): `icici_bank`, `icici_amazon_cc`, `icici_epm_cc`, `axis_airtel_cc`, `axis_myzone_cc`, `axis_bank`, `union_bank`, `yes_klick_cc`.

**`cardHolder`** (`'self' | 'spouse'`) is hardcoded per parser, not detected from the PDF. Change it in the relevant parser file.

**Dashboard (`/`)** fetches `type=debit` transactions only and excludes `Transfer`, `Rewards`, and `Investments` categories from spend totals.

**Gmail sync** (`/upload` → "Sync from Gmail"):
1. `GET /api/gmail/auth` — redirects to Google OAuth consent (scope: `gmail.readonly`)
2. `GET /api/gmail/callback` — exchanges the code for a refresh token; stores it in the `settings` Supabase table
3. `POST /api/gmail/sync` — searches Gmail for emails matching `has:attachment filename:pdf subject:statement|"credit card"|"bank statement"` since the last sync date; downloads each PDF attachment; attempts text extraction (no password, then an account-aware sender/subject-inferred password from env if `PasswordException`); runs the same parse → upsert pipeline as manual upload
4. `GET /api/gmail/status` — returns `{ connected, lastSyncAt }` for the UI

The `settings` table (key/value) also stores `gmail_last_sync_at`. Subsequent syncs use a 2-day overlap window to avoid missing late-arriving emails. Duplicate transactions are silently ignored by the unique constraint, so it is safe to sync repeatedly.

`src/lib/pdf.ts` contains the shared `extractTextFromPdf(buffer, password?)` utility used by both the manual upload route and the Gmail sync route.

## Key conventions

- **Tailwind v4** — CSS-first config, no `tailwind.config.js`. All theme customization lives in `src/app/globals.css`.
- **shadcn/ui** — style is `base-nova`, icons from `lucide-react`. Add components with `npx shadcn add <component>`.
- **Supabase client** (`src/lib/supabase/client.ts`) — lazy singleton exposed as a `Proxy`; safe to import at module level without triggering env-var errors at build time.
- `pdfjs-dist` must remain in `serverExternalPackages` in `next.config.ts` — it cannot be webpack-bundled.
- The `@/` path alias maps to `src/`.
