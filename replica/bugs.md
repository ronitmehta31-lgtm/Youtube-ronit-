# Bugs: Bahi

### BUG-001: sample data could load half-way
- Severity: S2
- Flow / case: F12 / F01-E2 (found by e2e)
- Screen: S02 setup, then any screen
- Build: 9811f59  Browser: Chromium 1194, 1440px

Steps
1. On setup, click "Try with sample data".
2. As soon as Home appears, reload or open a new invoice.

Expected: either all sample data or none.
Actual: the business profile was written first, so Home appeared while bills were still being written; a reload left the book half-filled and the next invoice number clashed ("INV-1 already exists").
Evidence: e2e F01-N1, F01-E2 and F15-H1 failures; console "Set up your business first".
Status: fixed. The sample is written in one database transaction (`src/lib/seed.ts`).

### BUG-002: phone width scrolled sideways on the bill form
- Severity: S3
- Flow / case: F01 at 390px
- Screen: S11
Steps: open New sale on a 390px-wide screen. Expected: page fits, item table scrolls inside its card. Actual: page was 829px wide.
Suspected cause: a screen-reader-only label (absolutely positioned) escaped the table's scroll container.
Status: fixed (positioned container). Covered by the SCR-* checks.

### BUG-003: paper-size picker stretched across the toolbar
- Severity: S4
- Screen: S12
Actual: width classes on inputs lost to the default full width. Status: fixed in the Input/Select primitives.

### BUG-004: chart bars failed an accessibility check
- Severity: S3
- Screen: S03
Actual: `aria-label` on SVG groups without a role (axe: aria-prohibited-attr). Status: fixed (`role="img"`).

Open: none. S1: none found.
