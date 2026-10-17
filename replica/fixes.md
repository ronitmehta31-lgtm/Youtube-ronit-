# What Vyapar's users hate, and what Bahi does about it

Evidence: 34 verbatim, linked reviews from 4 sources (App Store India feed, Trustpilot,
Software Advice, Google Play), in `reviews.csv`, ranked in `feedback.md`. That is far short of
the 100+ the method asks for. Reddit could not be read (the reader refuses the site), and Google
Play reviews could not be paged. Treat every theme below as **thin**: a pointer, not a trend.

`reviews.py`'s keyword themes misfire for this category ("billing" means invoices here, not
subscriptions), so the lists below come from reading every quote by hand.

## 1. What they hate

| # | problem | reviews | sources | quote |
| --- | --- | --- | --- | --- |
| H1 | Billing at a busy counter needs the mouse: Enter does not pick a typed item code, no key for the next row | 2 | 1 | "If you type an item code, you can't just press 'Enter' to select it." [Trustpilot](https://www.trustpilot.com/reviews/69b547672e94fd967a21e25e) |
| H2 | WhatsApp bill goes out before payment is recorded, so a paying customer sees "Balance Due" | 1 | 1 | "It makes customers think we are scamming them." [Trustpilot](https://www.trustpilot.com/reviews/69b547672e94fd967a21e25e) |
| H3 | Books that stop matching, or data lost | 3 | 1 | "there was mis matchign in teh previous entries" and "it did not match to my actual inventory and to the apps accounting" [Software Advice](https://www.softwareadvice.com/accounting/vyapar-profile/reviews/) |
| H4 | Duplicate items and parties can't be cleaned up; same-name customers are refused | 2 | 1 | "There is no way to just "merge" them." [Trustpilot](https://www.trustpilot.com/reviews/69b547672e94fd967a21e25e) |
| H5 | UPI QR only via a sale order, not on the invoice itself | 1 | 1 | "You can’t just print a direct Sale Invoice with a UPI QR code on it." [Trustpilot](https://www.trustpilot.com/reviews/69b547672e94fd967a21e25e) |
| H6 | Paying for licences and dealing with sales calls | 3 | 2 | "Annual License charges are somewhat higher." [Software Advice](https://www.softwareadvice.com/accounting/vyapar-profile/reviews/); "Advertising a huge discount … is misleading." [Trustpilot](https://www.trustpilot.com/reviews/6a61ea9fb730e85c675bc4f5) |
| H7 | Bugs and errors | 3 | 3 | "Frequently getting “Something went wrong” and “Failed to update” errors." [Google Play](https://play.google.com/store/apps/details?id=in.android.vyapar) |

## 2. What is missing

| # | request | reviews | sources | quote |
| --- | --- | --- | --- | --- |
| M1 | The same features on every device (iPhone users get less than Android) | 7 | 1 | "The features in android vs iOS is not comparable." [App Store](https://itunes.apple.com/in/reviews/id406683733) |
| M2 | Bank overdraft and loan accounts | 1 | 1 | "This software cannot accommodate both bank overdraft and loan accounts." [App Store](https://itunes.apple.com/in/reviews/id1431990981) |
| M3 | Custom staff permissions | 1 | 1 | "the available roles are limited and predefined" [Trustpilot](https://www.trustpilot.com/reviews/69b19d2ed37eea98863d7070) |
| M4 | Send the bill as a PDF straight from the app; more print themes | 1 | 1 | "directly send pdf to customer via app after generating invoice" [App Store](https://itunes.apple.com/in/reviews/id1701312938) |
| M5 | E-way bill and serial numbers on mobile | 1 | 1 | "I want features like android ewaybill and serial no" [App Store](https://itunes.apple.com/in/reviews/id1972918083) |
| M6 | Multi-device sync | 1 | 1 | "Sync problem we want to use it multiple device with synchronize each other." [Software Advice](https://www.softwareadvice.com/accounting/vyapar-profile/reviews/) |

## 3. What is unsolved

- **The busy retail counter.** The one detailed 1-star review is from a fast retail shop: the app suits
  "an office where you make 5 invoices a day", not a counter with a queue. Keyboard-first billing is the job.
- **Owners who just want their own books, no subscription.** For a single business, a licence, renewals and
  sales calls are cost and friction with nothing in return.

## Fix plan (built into Bahi)

| fix | size | status | evidence |
| --- | --- | --- | --- |
| Keyboard-first bill: Enter picks an exact code or barcode, Enter on a row field opens the next row, Ctrl+S / Ctrl+P, Alt+S for a new sale | S | built, tested (F01-H1) | H1 |
| Nothing is sent automatically. Share happens after save, and the message is built from the bill's real status ("fully paid" or the true balance) | S | built, tested (F01-H1 checks "fully paid", no "Balance due") | H2 |
| "Check my books" audit: duplicate numbers, lines that don't add up to the total, over-paid bills, broken links, negative stock, missing HSN. Balances are always computed from the bills, never stored, so they can't drift | M | built | H3 |
| Same-name parties allowed (told apart by phone); merge duplicate parties and items, moving every bill | S | built, tested (Duplicates) | H4 |
| UPI QR printed on any unpaid invoice, from your own UPI id, for the exact balance | S | built | H5 |
| One responsive web app: every feature on every phone, tablet and computer | M | built (by design) | M1 |
| Overdraft: bank accounts may go negative and show as "overdrawn" on the balance sheet; money in/out entries for loans | S | partial (no EMI schedule) | M2 |
| Yours, free, no licence: runs from any static host, data on your device | — | by design | H6 |
| Backup nudge every 7 days, full backup/restore file | S | built, tested (F15-H1) | H3 |
| Phone share sheet (share bill text from the app); PDF via "Save as PDF" in print | S | partial: the PDF is not attached automatically | M4 |
| Staff roles, multi-device sync | L | not built: needs the cloud path in `architecture.md` | M3, M6 |

## The angle

For your own shop: **the bill book that keeps up with your counter.** Bill from the keyboard as fast as
you can type codes, never send a customer a wrong "balance due", and see books that always add up.
No licence and no sales calls, and your data stays with you.
