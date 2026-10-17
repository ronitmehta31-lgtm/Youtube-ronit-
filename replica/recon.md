# Recon map: Vyapar (web)

Scope: the full app (billing, GST, inventory, purchases, expenses, cash and bank, reports, settings), rebuilt as one responsive web app
For: the user's own business (one owner, possibly a few staff users). Not for sale.
Date: 2026-10-17

Clean-room: this map records what Vyapar does and how a user moves through it.
No Vyapar code, assets, logos, invoice theme artwork or copy goes into the clone.

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | official feature list (blog) | https://vyaparapp.in/blog/vyapar-app-features/ | the most complete source: menu structure, every report, every setting |
| 2 | pricing page | https://vyaparapp.in/pricing | Gold vs Platinum gating: POS, godowns, loyalty, label printing, bulk WhatsApp, manufacturing, multi-company |
| 3 | marketing site | https://vyaparapp.in/ | positioning: GST billing + inventory + payment reminders, offline + cloud |
| 4 | Google Play listing | https://play.google.com/store/apps/details?id=in.android.vyapar | 4.8 from about 197k ratings; key-screen screenshots |
| 5 | App Store listing | https://apps.apple.com/in/app/vyapar-gst-invoicing-software/id6478382307 | screenshots |
| 6 | feature guides | https://vyaparapp.in/guides/feature-guides | per-feature how-tos |
| 7 | FAQ | https://vyaparapp.in/faq | item categories, units, backup |
| 8 | YouTube walkthrough | https://www.youtube.com/watch?v=BGmiDeuEgp0 | desktop billing flow, click by click |
| 9 | the user's own account | (not used) | not needed for a feature-level recon. Vyapar's terms were not checked for a non-compete clause, so if you use your own account to look at screens, check the terms first |

## Core loop

Make a GST invoice for a party in seconds, share it on WhatsApp, and track who still owes you money. Stock and reports update by themselves.

## Screens

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Sign in / sign up | /login | phone OTP or email login | phone input, OTP input | empty, error |
| S02 | Business setup | first run | firm name, GSTIN, state, address, logo, business type | form, file upload, state select | empty, filled, invalid GSTIN |
| S03 | Dashboard | / (left nav "Home") | receivable, payable, sale chart, cash in hand, stock value, bank balances, low stock, open orders | stat tiles, line chart, list cards | empty (new firm), filled |
| S04 | Parties list + detail | /parties | all customers and suppliers with balance; right pane shows the party's transactions | split list/detail, search, balance chips (to receive / to pay) | empty, filled, search no results |
| S05 | Add / edit party | modal from S04 or inline from S11 | name, phone, GSTIN, GST type, state, billing + shipping address, opening balance, credit limit, group, extra fields | modal, tabs (GST & address, credit, additional) | empty, validation error |
| S06 | Items list + detail | /items (tabs: products, services, categories, units) | stock qty and value per item; right pane shows item transactions | split list/detail, tabs, low-stock badge | empty, filled |
| S07 | Add / edit item | modal from S06 or inline from S11 | name, HSN/SAC, unit + secondary unit, category, item code / barcode, sale price (incl/excl tax), purchase price, GST rate, cess, opening stock, min stock, location, batch/expiry/MRP/serial | modal, tabs (pricing, stock), image upload | empty, validation error |
| S08 | Stock adjustment | from S06 item detail | add or reduce stock with reason and date | modal | |
| S09 | Units / categories | S06 tabs | manage units, conversions, categories | table, modal | empty |
| S10 | Sale invoices list | /sale/invoices | all invoices, filters by date / status (paid, unpaid, partial, overdue), totals | date range filter, table, status chip, row menu (print, share, duplicate, return, delete) | empty, filled |
| S11 | Transaction form (sale invoice) | /sale/invoices/new (Alt+S on desktop) | the core screen. Credit/cash toggle, party picker, invoice no + date, state of supply, items table (item, qty, free qty, unit, price, discount %, tax %, amount), additional charges, round-off, received amount, balance, payment type, notes, terms, attachments | party combobox with "add new", items grid with keyboard entry, barcode input, totals panel, payment split | empty, filled, validation error, unsaved-changes warning |
| S12 | Invoice preview / share | after save, or row menu | print (A4/A5/thermal 2-3-4"), PDF, image, WhatsApp, email, SMS link | preview frame, theme picker, share buttons | |
| S13 | Payment-In | /sale/payment-in (+ form) | record money received, link to invoices, discount during payment | form, invoice-link table | empty, filled |
| S14 | Estimate / quotation | /sale/estimates | same form as S11; status open/converted; convert to sale | S11 form, convert button | open, converted |
| S15 | Sale order | /sale/orders | same form as S11 with due date; convert to invoice | S11 form | open, closed |
| S16 | Delivery challan | /sale/challans | same form as S11, amount optional; convert to invoice | S11 form | open, closed |
| S17 | Sale return / credit note | /sale/returns | same form, links original invoice | S11 form | |
| S18 | Purchase bills | /purchase/bills | purchase side of S10/S11, reverse charge option | S10 table, S11 form | empty, filled |
| S19 | Payment-Out | /purchase/payment-out | money paid to suppliers | S13 form | |
| S20 | Purchase order | /purchase/orders | convert to bill | S11 form | open, closed |
| S21 | Purchase return / debit note | /purchase/returns | | S11 form | |
| S22 | Expenses | /expenses | expense categories (left), expense entries (right), with or without GST | split list, S11-style form | empty, filled |
| S23 | Other income | /other-income | same pattern as S22 | | |
| S24 | Bank accounts | /cash-bank/banks | accounts with balance; deposit, withdraw, bank-to-bank, adjust | split list/detail, modal | empty |
| S25 | Cash in hand | /cash-bank/cash | cash ledger, add/reduce cash | ledger table | |
| S26 | Cheques | /cash-bank/cheques | open/closed cheques, deposit or withdraw | table, status chip | |
| S27 | Loan accounts | /cash-bank/loans | loan, EMI and interest entries | split list/detail | empty |
| S28 | Reports hub | /reports | left list of every report (sections below), right pane shows the selected one | grouped nav, date range, party/item filters, export Excel/PDF/print | empty period, filled |
| S29 | GST reports | /reports/gst | GSTR-1, GSTR-2, GSTR-3B, GSTR-9, HSN summary, export JSON/Excel | tabs per table (B2B, B2CL, B2CS, CDNR, HSN...), export | |
| S30 | Settings | /settings (Shift+1 on desktop) | tabs: General, Transaction, Print, Taxes & GST, Transaction messages, Party, Item, Reminders | toggle list, number inputs, preview | |
| S31 | Tax rates | /settings/taxes | tax rates and tax groups (CGST+SGST, IGST, cess) | table, modal | |
| S32 | Invoice print designer | /settings/print | regular vs thermal, theme + colour, header/footer fields, paper size, text size | live preview, toggles | |
| S33 | Users and roles | /settings/users | invite staff: salesman, secondary admin, CA; limited permissions | table, invite modal | |
| S34 | Backup / restore / import | /utilities | Excel import of items and parties, export, backup download, restore, close financial year, verify data | upload, mapping table | errors on import |
| S35 | Firm switcher | top bar | multiple firms share parties and items | dropdown | single firm |
| S36 | Payment reminders | dashboard card + /reminders | overdue invoices, send reminder via WhatsApp/SMS | list, send button | none due |
| S37 | Online store (catalogue) | /store and public /s/:slug | share a catalogue link, receive orders, convert to sale | grid, public page, order inbox | empty |
| S38 | POS billing | /pos | fast counter billing, barcode-first, thermal print | big item grid, cart, numpad | |
| S39 | Godowns / stock transfer | /items/godowns | multiple stock locations, transfer between them | table, transfer form | |
| S40 | Manufacturing | /manufacture | bill of materials; consume raw material, produce finished goods | BOM form | |

## Flows

```
F01 Make a GST sale invoice and share it (the core loop)
    S10 -> S11 (pick party, add items, receive amount) -> save -> S12 share on WhatsApp
    happy path clicks: about 8 with an existing party and items (party, 2 items x qty, save, share)
    edge: new party typed inline, new item typed inline, inter-state party (IGST not CGST+SGST),
          unregistered party (B2C), price inclusive of tax, free qty, item out of stock,
          round-off, partial payment, cash sale with no party, duplicate invoice number

F02 Receive a payment against unpaid invoices
    S04 party -> S13 payment-in -> link to oldest invoices -> save -> receipt share
    happy path clicks: 5
    edge: amount more than due (advance), discount on payment, cheque payment (goes to S26)

F03 Record a purchase and update stock
    S18 -> purchase form -> save
    edge: reverse charge, supplier's bill number, batch/expiry entry, price changes update item purchase price

F04 Quote, then convert to invoice
    S14 estimate -> share -> S14 convert -> S11 prefilled -> save
    edge: estimate edited after sharing, partial conversion

F05 Sale order -> delivery challan -> invoice
    S15 -> convert -> S16 -> convert -> S11
    edge: stock reserved vs not, partial delivery

F06 Return goods (credit note)
    S10 row menu "return" -> S17 prefilled from invoice -> save
    edge: return more than sold, refund in cash vs adjust balance

F07 Record an expense
    S22 -> add category (first time) -> add expense with GST -> save

F08 Check who owes me money and remind them
    S03 receivable tile -> S36 -> send WhatsApp reminder with balance + invoice link

F09 Month-end GST filing prep
    S28 -> S29 GSTR-1 for month -> check B2B/B2C/HSN tabs -> export JSON/Excel for the CA
    edge: invoice without GSTIN on a B2B party, amendments in a later month

F10 Profit check
    S28 -> Profit & Loss / bill-wise profit / item-wise profit for a period

F11 Low stock -> reorder
    S03 low stock card -> S20 purchase order prefilled -> share with supplier

F12 First-run setup
    S01 -> S02 -> S11 first invoice (with a sample party/item prompt) -> S03

F13 Move money between cash and bank
    S24 deposit / withdraw / bank-to-bank

F14 Add a staff user with limited rights
    S33 invite -> role salesman -> staff can create sales, cannot edit or delete

F15 Import existing items and parties from Excel
    S34 upload -> column mapping -> preview errors -> import
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Button | primary, secondary, ghost, danger, icon | default, hover, focus, disabled, loading | all |
| Left nav | expanded, collapsed, mobile drawer | active item, nested group open | all |
| Top bar | with firm switcher, search, quick "+ Add Sale / + Add Purchase" | | all |
| Stat tile | money, count, with trend | positive, negative, zero | S03, S04 |
| Split list/detail | list + detail pane, mobile stacked | empty, selected, none selected | S04, S06, S22, S24, S27, S28 |
| Data table | sortable, with row menu, with totals footer | empty, loading, filled | S10, S13-S27, S28 |
| Date range filter | presets (today, this month, last month, quarter, FY, custom) | | S10, S28, S29 |
| Party combobox | search + "add party" row, shows balance | empty, no match, selected | S11-S21 |
| Item line grid | keyboard-first rows: item, qty, free qty, unit, price, disc %, tax %, amount | empty row, filled, out-of-stock warning, invalid | S11-S22 |
| Totals panel | subtotal, discount, tax breakup, charges, round-off, total, received, balance | | S11-S22 |
| Status chip | paid, unpaid, partial, overdue, open, converted, closed | | S10, S14-S20 |
| Modal form | small, large with tabs | validation error | S05, S07, S08, S24 |
| Toggle row (setting) | with description, with nested options | on, off, locked (plan) | S30-S33 |
| Money input | INR, negative allowed or not | | everywhere |
| Invoice document | A4, A5, thermal 58/80mm, several themes | | S12, S32 |
| Share sheet | WhatsApp, email, SMS, PDF download, print | | S12, S13, S36 |
| Toast | success, error, undo | | all |
| Empty state | with illustration and primary action | | every list |
| Chart | line (sales), bar (expenses by category) | empty period | S03, S28 |

## Inferred data model

```
Firm         id, name, gstin, gst_type (regular | composition | unregistered), state_code,
             address, phone, email, logo_url, financial_year_start, invoice_prefixes (json),
             settings (json)
             evidence: S02, S30, multi-firm setting      confidence: high

User / Membership  user_id, firm_id, role (owner | admin | salesman | ca), permissions (json)
             evidence: S33 user management               confidence: high

Party        id, firm_id, name, type (customer | supplier | both), phone, email, gstin,
             gst_type (registered | unregistered | composition | consumer), state_code,
             billing_address, shipping_address, opening_balance, opening_balance_date,
             credit_limit, group_id, extra_fields (json)
             evidence: S05, party settings                confidence: high

PartyGroup   id, firm_id, name                            confidence: high

Item         id, firm_id, kind (product | service), name, code, barcode, hsn_sac,
             category_id, base_unit_id, secondary_unit_id, conversion_rate,
             sale_price, sale_price_tax_inclusive (bool), purchase_price, purchase_price_tax_inclusive,
             tax_rate_id, cess_rate, mrp, opening_stock, opening_stock_date, min_stock,
             location, track_batches (bool), track_serials (bool), image_url, description
             evidence: S07, item settings                 confidence: high

ItemCategory id, firm_id, name                            confidence: high
Unit         id, name, short_name ; UnitConversion base_unit_id, secondary_unit_id, rate
             confidence: high

TaxRate      id, firm_id, name, rate, kind (gst | igst | cess | other), is_group,
             components (for a group: CGST 9 + SGST 9)
             evidence: S31 "tax rates and tax groups"     confidence: high

Transaction  id, firm_id, type (sale | sale_return | estimate | sale_order | delivery_challan |
             purchase | purchase_return | purchase_order | payment_in | payment_out |
             expense | other_income), number, prefix, date, time, party_id (nullable for cash
             sale), state_of_supply, is_reverse_charge, po_number, po_date, eway_bill_no,
             transport (json), subtotal, discount_amount, tax_amount, additional_charges (json),
             round_off, total, received_or_paid, balance, due_date, payment_terms,
             status (open | converted | closed | paid | partial | unpaid), source_txn_id
             (estimate -> invoice, invoice -> return), notes, terms, created_by,
             expense_category_id
             evidence: S10-S23, "link payment to invoices", convert buttons
             confidence: high. One table for all types is a guess at shape, but every
             screen shares the same form, which points to it.

TransactionLine id, transaction_id, item_id (nullable for free-text expense lines), description,
             qty, free_qty, unit_id, rate, rate_tax_inclusive, discount_pct, discount_amount,
             tax_rate_id, cgst, sgst, igst, cess, amount, batch_id, serial_no
             confidence: high

PaymentAllocation  payment_txn_id, invoice_txn_id, amount
             evidence: "link payment to invoices", paid/partial/unpaid status   confidence: high

PaymentMode  id, firm_id, kind (cash | bank | cheque), bank_account_id
TransactionPayment transaction_id, payment_mode_id, amount, reference
             evidence: "multiple modes of payments", payment type on S11      confidence: medium

BankAccount  id, firm_id, name, account_no, ifsc, upi_id, opening_balance, print_on_invoice
CashAdjustment / BankTransfer  id, firm_id, kind (deposit | withdraw | transfer | adjust),
             from_account, to_account, amount, date, note
             evidence: S24, S25                           confidence: high

Cheque       id, transaction_id, number, date, status (open | deposited | withdrawn | closed)
             confidence: medium

LoanAccount  id, firm_id, lender, opening_amount, interest_rate, ; LoanEntry (emi | interest | charges)
             confidence: medium

StockMovement id, firm_id, item_id, godown_id, date, qty_change, kind (opening | sale | purchase |
             return | adjustment | transfer | manufacture), transaction_line_id, batch_id
             evidence: item detail report ("adjust quantity, closing quantity")
             confidence: guess (Vyapar may compute stock from lines; a ledger is the safer design)

ItemBatch    id, item_id, batch_no, mfg_date, exp_date, mrp     confidence: high
Godown       id, firm_id, name                                  confidence: high (Platinum)
Bom          finished_item_id, raw_item_id, qty                 confidence: medium

ExpenseCategory / IncomeCategory  id, firm_id, name, kind       confidence: high

Reminder     party_id, transaction_id, sent_at, channel         confidence: guess
AuditLog     who changed or deleted which transaction           confidence: guess (passcode for edit/delete implies it matters)
```

Relationships: Firm 1-n everything. Party 1-n Transaction. Transaction 1-n TransactionLine.
Item 1-n TransactionLine, 1-n StockMovement. Payment Transaction n-n Invoice Transaction through
PaymentAllocation. Transaction 0-1 source Transaction (conversions and returns).

Reports are all queries over Transaction, TransactionLine, StockMovement, PaymentAllocation and
the cash/bank tables. No report needs its own table.

## Feature matrix

See `features.csv`. Must: 40, should: 38, could: 17, skip: 6.

## Out of scope (cannot or should not be cloned)

- Vyapar's name, logo, invoice theme artwork, illustrations and marketing copy. The clone gets its own.
- E-invoice (IRN) and e-way bill generation through the government portals. This needs GSP/ASP access
  and IRP API registration. Recording an e-way bill number someone typed in is fine; generating one is out
  until you register as an API user.
- Their bulk WhatsApp / SMS sending service. The clone opens WhatsApp with a prefilled message
  (wa.me link) instead. Bulk sending needs your own WhatsApp Business API account.
- Refer and earn, scratch cards, remote support, "Vyapar Premium" purchase, loan/credit marketplace
  offers. These are their business, not your product.
- The Windows offline desktop app. The web app can work offline later with a PWA, but full
  offline-first sync is a separate project.

## Size

Screens 40, flows 15, entities about 22. Hard parts:
1. GST correctness: CGST+SGST vs IGST by place of supply, tax-inclusive pricing, cess, rounding,
   composition scheme, and GSTR-1/3B in the exact government JSON format.
2. One transaction engine behind 12 document types, with conversions (estimate -> order -> challan ->
   invoice), returns, and payment allocation that keeps paid/partial/unpaid right after edits and deletes.
3. Reports: about 45 of them. Each is a query, but getting P&L, balance sheet, stock value (FIFO or
   average cost) and party balances to agree is the real accounting work.
Also: invoice PDF/thermal printing, keyboard-first billing, multi-firm, roles.

Size: XL for everything at once. Rescope into phases:
- Phase 1 (L, about a month): every `must` row. Parties, items, sale + purchase + returns, payments,
  GST invoice PDF + WhatsApp share, dashboard, core reports, GSTR-1/3B export.
- Phase 2: the `should` rows (orders, challans, estimates, expenses, cash/bank, more reports, roles).
- Phase 3: the `could` rows (POS, godowns, manufacturing, online store, loyalty).
