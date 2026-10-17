# Architecture: Bahi (a rebuild of Vyapar's core features)

For one business, run by its owner. Web app, phone and desktop. The working
name "Bahi" is set by replica-brand (see `brand.md`).

## The big decision: local-first

The default stack in this pack is Next.js + Postgres + auth + Stripe. That is
for a product you sell to many businesses. This is one business's books, so
the stack is a **local-first web app**:

- All data lives in the browser's IndexedDB on the owner's device. No server,
  no login, no monthly bill, works with no internet (PWA).
- Backup is a file you download (JSON) and restore anywhere. The app asks for
  one every 7 days and asks the browser for persistent storage, so the
  browser won't clear the data on its own.
- What you give up: live sync between two devices, and staff logins. If you
  need those later, the data layer (`src/lib/db.ts`) is the only file that
  talks to storage. Swap it for Supabase (Postgres + auth + row level security)
  without touching screens. The SQL for that is sketched at the bottom.

## Stack

| layer | choice | why |
| --- | --- | --- |
| web | Vite + React 18 + TypeScript | static build, deploys anywhere, fast dev loop |
| routing | React Router 6 (hash routes) | works from any static host and from a file, no server rewrites |
| styling | Tailwind 3, colours from `replica/design/tokens.json` as CSS variables | components use roles (`bg-surface`), never hex |
| database | IndexedDB via Dexie 4 | real indexed database in the browser, live queries, transactions |
| auth | none (single owner). Optional app PIN later | no account to lose |
| payments | none. UPI QR printed on the invoice from your own UPI id | customers pay you directly, no gateway fee |
| email / messages | WhatsApp share via wa.me links and the phone's share sheet | no WhatsApp Business API account needed |
| jobs | none. Reminders are computed when the app opens | nothing to run |
| files | logo stored in the database as a small data URL | backup carries it |
| hosting | any static host: Netlify, Vercel, Cloudflare Pages, GitHub Pages | free tier is enough |
| tests | Vitest (money, GST, ledger, reports), Playwright e2e (flows) | |

## Schema (Dexie stores)

Tables: 6. Access rules: none needed. Data never leaves the device except in a
backup file the owner downloads.

```ts
db.version(1).stores({
  parties:    'id, name, phone, gstin, createdAt',
  items:      'id, name, code, barcode, categoryId, createdAt',
  categories: 'id, kind, name',
  accounts:   'id, kind, name',
  txns:       'id, type, date, partyId, number, sourceId, [type+date], createdAt',
  meta:       'key',   // firm profile, settings, last backup time
});
```

Rules carried over from the pack's SQL guidance:

- ids are UUIDs (`crypto.randomUUID()`), so a future sync never collides
- **money is integer paise** everywhere, formatted only on screen
- dates are `YYYY-MM-DD` strings (a bill date is a calendar day, not an instant); `createdAt`/`updatedAt` are ISO UTC
- every transaction type lives in one `txns` table, with its lines embedded. Every
  Vyapar document shares one form, and stock, party balances and cash are all sums over it
- GST is computed per line when saved and stored on the line (taxable, cgst, sgst, igst, cess),
  so reports never recompute history after a rate change
- nothing is derived and stored: party balances, stock, cash and invoice paid/unpaid are
  computed from `txns` by pure functions in `src/lib/ledger.ts` (unit tested)
- deleting a party or item that has transactions is blocked; merge is offered instead

### Transaction types and what they move

| type | party balance | stock | cash/bank |
| --- | --- | --- | --- |
| sale | + (total - received) | - qty | + received |
| sale_return (credit note) | - (total - refunded) | + qty | - refunded |
| purchase | - (total - paid) | + qty | - paid |
| purchase_return (debit note) | + (total - refunded) | - qty | + refunded |
| payment_in | - (amount + discount) | | + amount |
| payment_out | + (amount + discount) | | - amount |
| expense | | | - paid |
| other_income | | | + received |
| estimate, sale_order, delivery_challan, purchase_order | none (documents) | none | none |
| stock_adj | | +/- qty | |
| transfer (cash/bank) | | | from -, to + |

Party balance is positive when they owe you.

## API

No server, so the API is the data layer: functions in `src/lib/db.ts` and
`src/lib/ledger.ts`, called from screens.

| function | does | flow |
| --- | --- | --- |
| `saveTxn(txn)` | validates, computes GST per line, assigns a number, writes | F01, F03, F06, F07 |
| `convertTxn(id, toType)` | copies an estimate / order / challan into a new invoice or bill, marks the source converted | F04, F05 |
| `deleteTxn(id)` | deletes, and unlinks payments that pointed at it | all |
| `savePayment(p)` | payment-in/out with links to invoices (oldest first by default) | F02 |
| `partyBalance`, `invoiceStatus`, `stockOf`, `accountBalance` | pure ledger functions | F02, F08, F11 |
| `report*` | each report is a pure function over the tables | F09, F10 |
| `gstr1Json(month)` | GSTR-1 in the GST portal's offline-tool JSON shape | F09 |
| `exportBackup()`, `importBackup(file)` | full JSON backup / restore | F15 |
| `importCsv(kind, file)` | items and parties from a spreadsheet saved as CSV | F15 |

Webhooks in/out: none. Jobs: none (backup and payment reminders are checked on app open).

## The parts that bite

- **GST correctness.** CGST+SGST when the place of supply equals the firm's state, IGST otherwise.
  Tax-inclusive prices are divided down per line. Rounding is per line to the paisa, then
  total round-off to the rupee is a separate visible line. All covered by unit tests.
- **GSTR-1 JSON.** The portal's format changes (B2CL threshold is ₹1,00,000 since Aug 2024; HSN is
  split into B2B and B2C tables from 2025). The export follows the current published shape, and the
  screen says to validate it in the GST offline tool before filing. Your CA should check the first month.
- **Edits after payment.** Editing an invoice total below what was already paid makes it "overpaid".
  The app shows that as an advance on the party, never as a negative due.
- **Duplicate numbers.** Two invoices with the same number is blocked at save.
- **Storage loss.** Browsers can clear site data. Mitigated by `navigator.storage.persist()`, the
  7-day backup nudge, and backup/restore. This is the biggest risk of local-first and the reason
  the backup banner is loud.
- **Time zones.** Bill dates are local calendar days stored as strings, so midnight in IST never
  shifts a bill to the wrong day or month.
- **Big data.** Ledgers compute in memory. Fine to tens of thousands of transactions. Past that,
  move to the Supabase path below.

## Build order

1. Vertical slice: setup (S02), add party (S05), add item (S07), sale invoice (S11), preview,
   print and WhatsApp share (S12), dashboard numbers (S03).
2. Must-haves: parties and items lists (S04, S06), stock adjust (S08), invoice list (S10),
   payment-in/out (S13, S19), returns (S17, S21), purchase (S18), reports + GSTR-1/3B (S28, S29),
   backup (S34).
3. Should-haves: estimates, orders, challans (S14-S16, S20), expenses and other income (S22, S23),
   cash and bank (S24, S25), reminders (S36), print settings (S32), CSV import.
4. Fixes from replica-entrepreneur: see `fixes.md`.

## Later: the cloud path (not built)

When a second device or staff login is needed, the same tables become Postgres on Supabase:

```sql
create table firms (id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null, gstin text, state_code char(2) not null, profile jsonb not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table parties (id uuid primary key, firm_id uuid not null references firms(id) on delete cascade,
  name text not null, phone text, gstin text, state_code char(2), opening_balance_paise bigint not null default 0,
  data jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index on parties (firm_id, name);
create table items (id uuid primary key, firm_id uuid not null references firms(id) on delete cascade,
  name text not null, code text, barcode text, hsn text, data jsonb not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index on items (firm_id, name);
create table txns (id uuid primary key, firm_id uuid not null references firms(id) on delete cascade,
  type text not null check (type in ('sale','sale_return','estimate','sale_order','delivery_challan','purchase',
    'purchase_return','purchase_order','payment_in','payment_out','expense','other_income','stock_adj','transfer')),
  number text, date date not null, party_id uuid references parties(id) on delete restrict,
  total_paise bigint not null default 0, data jsonb not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (firm_id, type, number));
create index on txns (firm_id, type, date);
create index on txns (firm_id, party_id);
-- RLS: every table `using (firm_id in (select id from firms where owner_id = auth.uid()))`
```
