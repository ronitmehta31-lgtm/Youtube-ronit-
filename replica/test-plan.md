# Test plan: Bahi

Automated: `bahi/e2e/flows.spec.ts` (Playwright, 27 cases) and `bahi/src/lib/core.test.ts` (Vitest, 19 cases).
Every e2e case fails on any console error; every screen gets an axe scan (serious and critical) and a 390px
no-sideways-scroll check. Run: `cd bahi && npm test && npx playwright test`.

| case | what | how | result 2026-10-17 |
| --- | --- | --- | --- |
| F12-N1 | empty name and bad GSTIN are refused at setup | e2e | pass |
| F12-H1 | setup lands on an empty home with "make your first bill" | e2e | pass |
| F01-H1 | new party and new item from inside the bill, keyboard only, Enter picks code, paid in full, invoice reads "Tax Invoice" and amount in words, WhatsApp text says fully paid, PDF downloads, stock drops | e2e | pass |
| F01-E1 | inter-state party switches to IGST | e2e | pass |
| F01-E2 | double-click on Save creates one invoice | e2e | pass |
| F01-N1 | cash sale with no party must be received in full | e2e | pass |
| F01-U* | GST maths: intra/inter split, inclusive prices, odd paisa, cess, round-off, GSTIN checksum | unit | pass |
| F02-H1 | receive payment from an invoice, it turns Paid | e2e | pass |
| F02-N1 | linking more than the payment is refused | e2e | pass |
| F02-U1 | oldest-first allocation | unit | pass |
| F04-H1 | estimate converts to invoice and shows Converted; estimates never move stock | e2e + unit | pass |
| F06-H1 | credit note from an invoice puts stock back | e2e | pass |
| F07-H1 | expense with category shows in the category report | e2e | pass |
| F09-H1 | GSTR-1 JSON downloads with the right GSTIN and period | e2e | pass |
| F09-U1 | B2B / B2CL (> ₹1,00,000 inter-state) / B2CS split, 3B payable after credit | unit | pass |
| F10-U1 | P&L gross profit equals sale minus cost for every sold unit | unit | pass |
| F15-H1 | backup, erase, restore brings everything back | e2e | pass |
| F15-H2 | CSV import with quoted commas; a bad row is reported, the rest imported | e2e | pass |
| DUP-1 | same-name party allowed, then merged | e2e + unit | pass |
| DEL-1 | deleting an invoice unlinks its payments | unit | pass |
| SCR-* | 13 screens: axe clean, no sideways scroll at 390px | e2e | pass |
| FILE-1 | `release/bahi.html` opened from disk: sample loads, survives reload, PDF downloads, no errors | scripted browser | pass |

## Manual checks for you (cannot be automated here)

- [ ] Print an A4 bill and a thermal receipt on your own printer (browser print, margins "default").
- [ ] On your Android phone: Send PDF opens the share sheet with the PDF attached; pick WhatsApp.
- [ ] Scan the UPI QR on an unpaid bill with your UPI app: it shows your name and the exact balance.
- [ ] A USB or Bluetooth barcode scanner: scan into the item box, the item is added.
- [ ] Import your real item list from Excel (save as CSV first).

## To check (not reproduced)

- Very large books (20,000+ bills) were not load-tested; balances are computed in memory.
- Safari/iOS private mode may refuse IndexedDB; the app would not open there.
