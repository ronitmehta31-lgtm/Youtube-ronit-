# Brand: Bahi

**Name: Bahi** (बही, the ledger book a shop keeps). Kept as the working name because this app is for your
own business, not for sale. Screening on 2026-10-17 (web search "Bahi billing app GST accounting"): the
word is generic in this category, and "SmartBahi" is an existing GST billing app on Google Play. If you ever
sell or publish Bahi, pick a distinctive name first and run the checks below; as a private tool the name
is just a label.

| check | result |
| --- | --- |
| web search, name + category | run 2026-10-17: generic word, SmartBahi exists |
| India trademark (ipindia.gov.in, class 9 and 42) | to run (only if you sell it) |
| domain, app stores, social handles | to run (only if you sell it) |

**Palette**: deep teal accent on white with green-grey neutrals, a different hue family from the original's
red and blue. All 20 text/background pairs pass WCAG AA (`design/tokens.json`). The colours in `brand.json`
for the sweep are approximate, not measured from the original.

**Logo**: placeholder mark in `bahi/public/icon.svg` (a "B" drawn as two ledger bindings on teal). Brief for
a real one: wordmark plus symbol, must read at 16px and 1024px, must not resemble the original's mark.

**Voice**: plain, quick, shopkeeper-to-shopkeeper. "Make your first bill", not "Create a new transaction".
Every label and message was written fresh; none copied from the original.

**Sweep**: `python3 .claude/skills/replica-brand/sweep.py bahi --config replica/brand.json` → clean.
