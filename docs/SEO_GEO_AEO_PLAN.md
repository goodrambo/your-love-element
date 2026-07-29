# SEO, GEO, and AEO Plan

Last reviewed: 2026-07-30

This plan treats SEO as crawl, relevance, and search-result quality; AEO as concise, extractable answers to real questions; and GEO as making the site useful and trustworthy enough to be cited in generative search. GEO and AEO are not separate ranking systems that replace SEO.

## Outcome

Build a durable organic acquisition surface for the English-market relationship reading without mass-producing generic astrology pages or making claims the product cannot support.

Primary outcomes over 90 days after publication:

- Index the homepage, Five Elements love guide, and methodology page without canonical or structured-data errors.
- Earn non-brand impressions for Five Elements relationship questions and qualified clicks into the free reading.
- Create pages that search and generative systems can quote accurately because definitions, scope, sources, and limitations are explicit.
- Measure organic visits through quiz start, preview reveal, and checkout creation without treating rankings or AI citations as guaranteed.

## Baseline on 2026-07-30

- The homepage had canonical, social metadata, Product markup, FAQ markup, and an XML sitemap.
- `robots.txt` allowed crawling and pointed to the sitemap.
- The full-report completion page correctly used `noindex,follow` and was absent from the sitemap.
- The indexable site consisted mostly of one transactional homepage plus support/legal pages.
- The homepage answered purchase questions but did not provide a substantial definition of the Five Elements, a compatibility model, a methodology disclosure, or a crawlable content cluster.
- Search Console ownership was verified, but performance data was still processing, so no query or landing-page baseline was available.

## Strategy

### 1. Technical SEO

- Keep one self-referencing canonical per page.
- Keep the paid completion surface out of the index while allowing link following.
- Include every indexable page, and no `noindex` page, in `sitemap.xml`.
- Use honest `lastmod` dates only for meaningful content changes.
- Keep primary content in server-delivered HTML instead of requiring JavaScript rendering.
- Maintain unique titles, descriptions, and one clear `h1` per page.
- Validate local references and JSON-LD on every Harness run.

### 2. Entity and trust clarity

- Define Your Love Element consistently as a modern Five Element-inspired relationship-reflection product.
- Link the site, publisher, pages, article content, product, and breadcrumbs through stable JSON-LD identifiers.
- Explain the distinction between this framework and traditional BaZi, astrology, feng shui, Chinese medicine, or clinical assessment.
- State how free and paid readings are created, including the deterministic foundation and the limited role of generative AI.
- Never invent an author biography, customer review, scientific validation, rating, or social profile.

### 3. Answer engine optimization

- Put a 40–60 word direct answer immediately below the main question on explanatory pages.
- Use question-shaped headings, short definitions, lists, and comparison language that remain clear when extracted from the surrounding page.
- Keep FAQ content visible to readers and aligned with its JSON-LD.
- Treat FAQ markup as machine-readable semantics, not as a promise of Google FAQ rich results. Google limits regular FAQ rich results primarily to authoritative government and health sites.

### 4. Generative engine optimization

- Publish unique product-specific interpretations instead of summaries that could come from any astrology site.
- Cite an independent scholarly source for the historical Five Phases context.
- Separate sourced background, product-specific interpretation, and limitations so a generated answer can attribute each claim correctly.
- Use clear dates and publisher identity on editorial pages.
- Keep pages crawlable and snippet-eligible. Do not add unproven AI-only files or duplicate content for every possible prompt variation.

### 5. Content architecture

The initial cluster is intentionally compact:

1. Homepage: product, free reading, direct Five Elements summary, purchase answers.
2. `/five-elements-love-compatibility/`: comprehensive pillar guide covering the five patterns, supportive cycle, friction, repair, and FAQ.
3. `/how-it-works/`: inputs, scoring boundary, AI disclosure, safeguards, privacy, limitations, and FAQ.

Do not create five near-duplicate element pages yet. Expand only after Search Console shows distinct query demand that cannot be satisfied well by the pillar guide. Candidate follow-ups include compatibility examples, relationship-repair prompts by element, and individual element pages with genuinely unique depth.

## Implemented locally on 2026-07-30

- Added the comprehensive Five Elements love and compatibility guide.
- Added a transparent methodology and limitations page.
- Added a direct-answer Five Elements section and deeper FAQ coverage to the homepage.
- Added internal links among the homepage, guide, method, reading, policies, and support.
- Expanded homepage entity and WebPage structured data.
- Added Article, WebPage, BreadcrumbList, and FAQPage structured data to both editorial pages.
- Added index/snippet directives, social metadata, sitemap URLs, and honest modification dates.
- Added an automated SEO regression suite covering metadata uniqueness, one-`h1` structure, sitemap/noindex alignment, robots discovery, schema types, internal cluster links, and methodology disclosures.

These changes are unpublished local work until a separately authorized frontend release is committed, pushed, deployed, and verified.

## Publication and measurement sequence

Publication is a separate production action and follows the deployment runbook.

1. Review the new editorial copy and brand presentation.
2. Publish only after explicit authorization.
3. Verify production HTTP status, canonical, robots, sitemap, rendered content, and structured data.
4. Resubmit the sitemap in Google Search Console and inspect the two new URLs.
5. Import the verified property into Bing Webmaster Tools; consider IndexNow only when a project-scoped key and release workflow are approved.
6. Record weekly, by page and query: indexed status, impressions, clicks, CTR, average position, organic landing sessions, quiz starts, previews, and checkout creations.
7. Review at 30, 60, and 90 days. Improve titles/snippets when impressions exist but CTR is weak; improve content and internal links when indexing succeeds but relevant impressions do not appear.

AI referral traffic may be recorded when referrers are available, but absence of a referrer does not prove absence of generative-search exposure. AI citations should be sampled manually and treated as directional evidence, not a stable KPI.

## Guardrails

- No keyword stuffing, hidden text, doorway pages, fabricated expertise, or scaled commodity content.
- No schema property unless the claim is visible and true on the page.
- No ratings or review markup without verified customer evidence and policy review.
- No promise of ranking, rich results, or citation by an AI system.
- No separate crawler rules that accidentally block ordinary search or snippet eligibility.
- No deployment, Search Console mutation, Bing setup, or IndexNow notification without the required authority.

## Primary references

- [Google: Optimizing for generative AI features](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)
- [Google: Search guide for developers](https://developers.google.com/search/docs/fundamentals/get-started-developers)
- [Google: Generative AI content guidance](https://developers.google.com/search/docs/fundamentals/using-gen-ai-content)
- [Google: Product structured data](https://developers.google.com/search/docs/appearance/structured-data/product)
- [Google: FAQ rich-result eligibility changes](https://developers.google.com/search/blog/2023/08/howto-faq-changes)
- [Bing: IndexNow and Webmaster Tools](https://blogs.bing.com/webmaster/June-2025/Start-Using-Bing-Webmaster-Tools-to-Improve-Your-Site-Visibility)
- [Internet Encyclopedia of Philosophy: Wuxing](https://iep.utm.edu/?p=12533)
