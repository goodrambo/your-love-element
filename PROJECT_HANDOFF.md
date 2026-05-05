# Your Love Element Project Handoff

Last updated: 2026-05-05

## Current Live Site

- Production domain: https://yourloveelement.com/
- GitHub repo: https://github.com/goodrambo/your-love-element
- GitHub Pages source: `main` branch, root directory
- Custom domain file: `CNAME`
- HTTPS is enforced through GitHub Pages
- DNS is managed in Cloudflare with GitHub Pages A/AAAA records and `www` CNAME

## Current Product Direction

Your Love Element is a mobile-first H5-style relationship reading product.

The core funnel:

1. User completes a free 10-question reading.
2. Site shows a free preview report.
3. Paid full report is positioned at `$9.99`.
4. After Lemon Squeezy checkout, user returns to `/full-report/`.
5. User completes 8 deeper relationship signals.
6. Future implementation generates/delivers the full report.

## Pages and Assets

Main pages:

- `/` - homepage and free 10-question reading
- `/contact/` - contact/support page
- `/privacy/` - privacy policy
- `/terms/` - terms of service
- `/refund/` - refund policy
- `/full-report/` - prepared post-checkout 8-question paid signal flow

Important files:

- `index.html` - homepage/free reading
- `script.js` - free quiz, paid quiz, cookie consent
- `styles.css` - all site styles
- `full-report/index.html` - paid 8-question flow
- `lemon-squeezy-product-copy.md` - Lemon Squeezy product copy
- `paid-report-sample.md` - paid report sample draft
- `assets/logo-mark.svg` - site logo
- `assets/lemon-squeezy-store-icon.png` - Lemon Squeezy store icon
- `assets/social-preview.png` - Open Graph/social preview image

## Confirmed Decisions

- Free reading stays at 10 questions.
- Paid full report adds 8 extra questions.
- Paid 8 questions happen after checkout, not before checkout.
- Price is currently planned as `$9.99`.
- CTA stays as `Join early access` until Lemon Squeezy payment approval is complete.
- `/full-report/` is intentionally not in the main nav yet.
- Clean URLs are preferred:
  - `/privacy/`, not `/privacy.html`
  - `/contact/`, not `/contact.html`
  - logo links should go to `/`, not `index.html`
- Footer should be centered and professional:
  - customer support email: `support@yourloveelement.com`
  - copyright: `© 2026 Your Love Element. All rights reserved.`
- Cookie consent currently only stores user preference; no analytics/pixels are loaded yet.

## Free 10 Questions

Current free reading signals:

1. Current love-life state
2. What the user wants to understand
3. Magnetic partner quality
4. Relationship element style
5. Likely meaningful meeting field
6. Pull-away pattern
7. Secure relationship feeling
8. Compliment/mirror signal
9. Trusted romantic pace
10. Birthday month/day

The free preview currently outputs:

- Future partner portrait
- Element profile
- Mini analysis:
  - recognition sign
  - meeting signal
  - pattern to release
  - next step

## Paid 8 Questions

Current `/full-report/` paid signal flow:

1. When you start liking someone, what happens inside you first?
2. In past relationships, which pattern has shown up most?
3. What kind of reassurance matters most to you?
4. How do you usually handle conflict?
5. Which partner energy would feel most healing now?
6. What are you no longer willing to accept?
7. What would make you trust love faster?
8. What kind of 30-day guidance would help you most?

These are intended to refine:

- attachment pattern
- past pattern
- reassurance need
- conflict style
- partner energy
- boundaries
- trust signal
- 30-day guidance

## Current Report Logic

The current free preview is a front-end rules-based composition, not AI generation.

Important behavior:

- `quality` selects the main archetype:
  - `Emotional steadiness` -> `The Grounded Visionary`
  - `Creative ambition` -> `The Magnetic Builder`
  - `Warm intelligence` -> `The Gentle Strategist`
  - `Playful confidence` -> `The Bright Companion`
- `element` selects element copy.
- `status`, `intent`, `setting`, `block`, `secure`, and `pace` are inserted into the partner portrait and mini analysis text.

Known limitation:

- It does not generate a unique report for every possible answer permutation.
- Next recommended upgrade is a scoring model:
  - archetype score
  - element score
  - attachment score
  - pace/readiness score
  - boundary score
  - compatibility style score

## Lemon Squeezy Setup

Payment approval is still under review.

Prepared product:

- Product name: `Your Love Element: Full Relationship Report`
- Price: `$9.99`
- Product type: digital product / personalized report
- Store icon: `assets/lemon-squeezy-store-icon.png`
- Product copy: `lemon-squeezy-product-copy.md`
- Planned post-purchase redirect: `https://yourloveelement.com/full-report/`

When Lemon Squeezy approval passes:

1. Create product in Lemon Squeezy.
2. Paste copy from `lemon-squeezy-product-copy.md`.
3. Upload `assets/lemon-squeezy-store-icon.png`.
4. Set checkout button text: `Unlock full report`.
5. Set post-purchase redirect to `/full-report/`.
6. Replace homepage `Join early access` CTA with Lemon Squeezy checkout link.

## Design/Layout Decisions

- Site should feel premium, intimate, and mobile-first.
- Avoid making it look like a generic landing page.
- Homepage hero is the main app experience, not a marketing-only hero.
- Preview report layout has been iterated several times.
- Current preferred structure:
  - centered preview heading
  - left column: long partner portrait + compressed free preview summary
  - right column: mini analysis + refinement explanation + paid CTA
- `Your free preview includes` should stay compact, not a large empty card.
- Future partner portrait should be longer than the first MVP version, but the free preview should not give away the full paid report depth.

## Commercial/Legal Pages

Added:

- Contact
- Privacy Policy
- Terms of Service
- Refund Policy

Important caveat:

- These are practical first drafts, not legal advice.
- Update them once final delivery, refund, data handling, and payment processes are finalized.

## Cookie Consent

Current behavior:

- Shows a cookie consent popup.
- Options:
  - `Essential only`
  - `Allow all`
- Stores choice in localStorage key: `yle-cookie-consent`
- Includes a localStorage safety fallback for browsers/private modes where storage may fail.

Important future task:

- If analytics, Meta pixel, Google tag, or tracking scripts are added, they must respect the stored consent choice.

## DNS / GitHub Pages Notes

Cloudflare DNS should include:

- `@` A records:
  - `185.199.108.153`
  - `185.199.109.153`
  - `185.199.110.153`
  - `185.199.111.153`
- Optional but currently recommended `@` AAAA records:
  - `2606:50c0:8000::153`
  - `2606:50c0:8001::153`
  - `2606:50c0:8002::153`
  - `2606:50c0:8003::153`
- `www` CNAME:
  - `goodrambo.github.io`

All Cloudflare records should stay DNS only / gray cloud for GitHub Pages.

## Gotchas / Things We Already Hit

- GitHub CLI token was invalid at first; re-auth was required with `gh auth login`.
- Local `.git` writes sometimes required escalated permissions.
- GitHub Pages custom domain showed DNS success before HTTPS checkbox was ready.
- HTTPS was eventually enabled successfully through GitHub API.
- GitHub Pages builds often showed `building` for a while even after files were pushed; latest build endpoint eventually showed `built`.
- Static clean URLs require folder-based pages:
  - `privacy/index.html`
  - `terms/index.html`
  - `refund/index.html`
  - `contact/index.html`
- Pages inside subfolders need relative asset paths like `../assets/logo-mark.svg`, `../styles.css`, and `../script.js`.
- Quick Look converted `social-preview.svg` to a square image, so `social-preview.png` was generated separately at proper `1200x630`.
- The free preview logic currently depends on DOM IDs in `index.html`; changing IDs requires updating `script.js`.
- `script.js` is shared by homepage, legal pages, and `/full-report/`, so feature initializers need to guard against missing DOM nodes.

## Immediate Next Tasks

Recommended next session order:

1. Build a scoring model for free + paid answers.
2. Decide final full report structure and output format:
   - browser page
   - PDF
   - email delivery
   - hybrid
3. Connect Lemon Squeezy checkout after approval.
4. Add order verification before allowing `/full-report/` to submit/generate.
5. Add report generation/delivery.
6. Replace `Join early access` CTA with real checkout link.
7. Update Terms/Refund/Privacy based on actual delivery and payment behavior.
8. Test social previews with live URL after major copy/image changes.

## Useful Commands

Check JS:

```bash
node --check script.js
```

Run local static server:

```bash
python3 -m http.server 8765
```

Check GitHub Pages build:

```bash
gh api repos/goodrambo/your-love-element/pages/builds/latest
```

Check Pages config:

```bash
gh api repos/goodrambo/your-love-element/pages
```
