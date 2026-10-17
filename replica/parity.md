# Parity: Bahi vs Vyapar

Date: 2026-10-17. Feature score from `features.csv` via `replica-diff/parity.py`.

## Verdict: shippable for your own use, with one check to do yourself

- Feature parity **86.4 / 100**, must-haves **38 of 39**, no open S1 or S2 bugs (`bugs.md`).
- The one partial must-have is GSTR-1: the JSON follows the portal's offline-tool shape but has not been
  validated against the GST offline tool (it can't run here). **Before your first filing, import the JSON
  into the offline tool or hand it to your CA and compare.** After one good month, treat it as done.
- Layout diff: **not run.** Recon used public pages only, so there are no screenshots of Vyapar to compare
  against. Bahi's screenshots are in `clone-screens/` for future regression diffs.
- It also carries six fixes Vyapar's users asked for (`fixes.md`), so by the pack's definition it is
  "better than the original" for a single-owner shop, within the scope it covers.

## Behaviour differences

| flow | Vyapar | Bahi | keep or fix |
| --- | --- | --- | --- |
| F01 bill | item picked from a dropdown with the mouse (per review) | type code or barcode, Enter adds it, Enter opens next row; 8 keystrokes-ish for a 2-item bill | keep |
| F01 share | WhatsApp sent on create, can say "balance due" on a paid bill (per review) | nothing auto-sent; message reads the real status | keep |
| F01 cash sale | cash sale allowed | cash sale without a saved party must be paid in full (no orphan balances) | keep |
| login | phone OTP account, cloud sync | no account, data on the device, backup file | keep for one owner; cloud path in `architecture.md` |
| duplicates | can't delete or merge duplicates (per review) | merge parties and items | keep |

## Top five to build next

1. Validate GSTR-1 against the offline tool with one real month (yours, with your CA).
2. Secondary units (box of 12 = 12 pcs).
3. Batch and expiry tracking with the 30-day expiry list (needed for pharmacy, FMCG).
4. Cheque status (open, deposited, bounced).
5. Staff logins and multi-device sync: the cloud path (Supabase) in `architecture.md`.

## Raw output: Parity: 86.4 / 100

features 86.4  (94 counted, must-haves 38 of 39 done)

Not shippable yet: 1 must-have features are not done.

## By area, weakest first
- settings                       0.0  (3 features)
- store                          0.0  (1 features)
- items                         73.5  (15 features)
- gst                           73.5  (8 features)
- utilities                     75.0  (4 features)
- cash-bank                     78.6  (4 features)
- print                         85.7  (7 features)
- parties                       92.9  (5 features)
- sale                          93.5  (19 features)
- reports                       96.7  (13 features)
- onboarding                   100.0  (1 features)
- dashboard                    100.0  (1 features)
- payments                     100.0  (4 features)
- share                        100.0  (1 features)
- purchase                     100.0  (3 features)
- core                         100.0  (3 features)
- expense                      100.0  (2 features)

## Missing, in build order
- [must] gst: GSTR-1 report with JSON / Excel export, partial  (JSON in the offline-tool shape plus HSN CSV; not validated against the GST offline tool here)
- [should] items: Expiring items list (30 days), no
- [should] items: Secondary unit with conversion, no
- [should] settings: Users and roles (owner admin salesman CA), no  (needs the cloud path)
- [should] cash-bank: Cheques tracking (open / deposited), partial  (cheque payments are listed; no open/deposited status)
- [should] gst: GSTR-2 and HSN summary, partial  (HSN summary of purchases; GSTR-2 is no longer a filed return)
- [should] items: Barcode on items and barcode scan while billing, partial  (USB/Bluetooth scanners work (type into the item box + Enter); no camera scanning)
- [should] items: Batch / expiry / MRP tracking, partial  (MRP only)
- [should] parties: Party groups, partial  (group field on parties; no group reports)
- [should] print: Invoice themes and colour (own designs), partial  (one layout, any colour)
- [should] reports: Balance sheet, partial  (from bills, cash, stock and GST; no fixed assets or loan ledgers)
- [should] sale: Additional charges (shipping packing), partial  (one named charge per bill)
- [could] gst: Composition scheme (GSTR-4 / CMP-08), no
- [could] gst: GSTR-9 annual, no
- [could] items: Godowns and stock transfer, no  (location field on items only)
- [could] items: Manufacturing (bill of materials), no
- [could] items: Serial number tracking, no
- [could] print: Barcode / label printing, no
- [could] sale: Loyalty points, no
- [could] sale: POS billing screen, no  (keyboard billing and thermal print cover a counter)
- [could] settings: Multiple firms under one login, no
- [could] settings: Passcode for edit and delete + audit log, no
- [could] store: Online store / catalogue link with orders, no
- [could] utilities: Tally export, no
- [could] cash-bank: Loan accounts and EMI, partial  (overdraft accounts and money in/out entries; no EMI schedule)
- [could] utilities: Close financial year, partial  (change the prefix to restart numbering; no closing entries)

## Left out on purpose (not scored)
- Sign in with phone OTP or email: local-first single-owner app: no account, data stays on the device
- E-invoice (IRN) generation: needs IRP API registration through a GSP. Revisit if turnover requires e-invoicing
- E-way bill generation on the portal: needs NIC e-way bill API access. Record the number only
- Bulk WhatsApp / SMS sending: needs your own WhatsApp Business API account. wa.me links cover single sends
- Refer and earn / scratch cards: their business not yours
- Remote support / tutorials / premium purchase: their business not yours
- Windows offline desktop app: web scope. PWA row covers basic offline

## Yours, not in the original (not scored)
- Enter picks an exact code or barcode and moves to the next row
- Share message built from the real payment status, never auto-sent
- Check my books audit
- Same-name parties allowed; merge duplicate parties and items
- UPI QR for the exact balance on any unpaid invoice
- Weekly backup nudge
