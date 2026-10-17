# Bahi

GST billing, stock and accounts for your own shop. Works offline in the browser on phone and computer;
your books stay on your device. Rebuilt clean-room from a popular billing app's public feature set, with fixes for what
its users complain about (see `../replica/fixes.md`).

## Use it

- **Easiest:** open `release/bahi.html` in Chrome or Edge. Click "Try with sample data" to look around,
  or fill in your business details to start for real.
- **On your phone too:** publish it with GitHub Pages (see `../replica/deploy.md`), then "Add to Home screen".
- **Back up weekly:** Backup → Download backup. Restore the file on any device.

## What it does

Bills (GST invoice, estimate, sale order, delivery challan, credit note, purchase bill, purchase order,
debit note, expenses, other income) · CGST/SGST or IGST by place of supply · tax-inclusive prices, cess,
round-off · keyboard billing (item code or barcode + Enter) · print A4 / A5 / thermal 80 / 58mm, Send PDF,
WhatsApp with the true paid/balance status, UPI QR for the balance · payments linked to bills · stock with
low-stock alerts, adjustments and history · parties with balances, statements, reminders, merge · cash and
bank accounts · 20 reports (P&L, balance sheet, cash flow, day book, bill/item/party profit, stock, HSN, tax)
· GSTR-1 JSON and GSTR-3B summary · CSV import/export · "check my books" audit.

Not included: staff logins, multi-device sync, multiple firms, batches/expiry, secondary units, e-invoice
and e-way bill generation. See `../replica/parity.md`.

## Develop

```bash
npm install
npm run dev            # http://localhost:5173
npm test               # unit tests (GST, ledger, reports, database)
npm run build && npx playwright test   # end-to-end (set PW_CHROMIUM to a Chromium path if needed)
npm run build:single   # release/bahi.html
```

Code map: `src/lib/gst.ts` tax maths · `src/lib/ledger.ts` balances (always computed, never stored) ·
`src/lib/reports.ts` every report and GSTR · `src/lib/db.ts` the only file that touches storage ·
`src/pages/TxnForm.tsx` the bill screen. Design tokens: `../replica/design/tokens.json`.
