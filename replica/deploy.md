# Deploy checklist: Bahi

Bahi is a static, local-first app: no server, no database host, no keys, no payments, no email.
Most of the pack's production checklist does not apply, and is marked n/a with the reason.

## Preflight (run 2026-10-17)

- [x] e2e suite green: 27 passed / 27 (`npx playwright test`), unit 19 / 19 (`npm test`)
- [x] no open S1 or S2 bugs (`bugs.md`: 4 found, 4 fixed)
- [ ] parity: must-haves 38/39, feature score 86.4. The open one is GSTR-1 validation, which only you can do
  (import the JSON into the GST offline tool for one real month). Not a blocker for billing; check it before you file.
- [x] rebrand sweep clean (`sweep.py` exit 0)
- n/a store listing: not shipping to app stores
- [x] production build passes (`npm run build`, and `npm run build:single` for the one-file version)
- n/a privacy policy: no data leaves the device, no processors. Add one if you ever host it for others.
- n/a account deletion: no accounts. Settings → Erase all data wipes the device.
- [x] favicon, title and icon are Bahi's own

## Ways to run it

**1. One file, no setup (works today).** `bahi/release/bahi.html`. Open it in Chrome or Edge on your shop
computer. It works offline. Keep the file in one folder and always open it from there in the same browser
(bookmark it); your books live in that browser, not inside the file.

**2. Your own web address, free (recommended for phone + computer).** The repo already has
`.github/workflows/bahi-pages.yml`.
1. Merge this branch into the default branch.
2. GitHub → repo Settings → Pages → Source: **GitHub Actions**.
3. The workflow tests, builds and publishes. The address is shown on the workflow run, like
   `https://<your-user>.github.io/<repo>/`.
4. Open it on your phone and use the browser's "Add to Home screen". It installs like an app and works offline.

Each device keeps its own books. To move books between devices, use Backup → Download, then Restore on the other.

**3. Your own domain (optional).** After step 2, Settings → Pages → Custom domain, then at your registrar:

| record | name | value |
| --- | --- | --- |
| CNAME | www (or `bahi`) | `<your-user>.github.io` |
| A | @ (only if you use the bare domain) | 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153 |

Tick "Enforce HTTPS" once the certificate is issued. No email DNS needed: Bahi sends no email.

## Production

- n/a database, env vars, Stripe, OAuth, email: none used
- [ ] **Your backup routine.** The only production duty: Backup → Download backup at least weekly, and keep the
  file in Google Drive or email. The app nags after 7 days.

## Watch

- n/a error tracking, uptime, analytics: static files, nothing to monitor, nothing tracked
- [ ] core flow on the live address, on your computer and phone: make a bill, send the PDF on WhatsApp, receive a payment
