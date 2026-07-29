# AI Report Generation

Last updated: 2026-05-13

## Goal

The paid report should feel:

- personalized
- coherent
- emotionally warm
- grounded in the user's answers
- consistent with the Five Element-inspired product language
- structured enough to render reliably in email

It should not expose raw scoring tables or claim professional advice.

## Inputs

Free answers:

```text
status
intent
quality
element
setting
block
secure
mirror
pace
birthdate
```

Paid answers:

```text
attachment
conflict
reassurance
boundary
trust
pattern
readiness
partner_climate
```

## Deterministic Scoring

Before calling OpenAI, the Worker computes a deterministic scoring profile.

Main function:

```text
buildRelationshipScoringProfile()
```

Dimensions:

- primary/supportive Love Element blend
- attachment rhythm
- relationship pace
- chemistry vs stability lens
- boundary clarity
- growth focus
- desired partner climate

Why this exists:

- gives the report a stable interpretation backbone
- reduces random model drift
- makes outputs more reproducible
- lets future products tune scoring without rewriting all prompts

Raw numeric scores are internal and stored in:

```text
report_json.scoring_model
```

The customer sees:

```text
Your Relationship Signal Profile
```

## OpenAI Generation

Configured model:

```text
gpt-5.5
```

Worker function:

```text
generateReport()
```

API:

```text
https://api.openai.com/v1/chat/completions
```

The prompt instructs the model to:

- return strict JSON
- use the scoring profile as the interpretation backbone
- avoid raw numeric scores
- keep language warm and user-facing
- include required report sections
- maintain entertainment/reflection boundaries

## Required Report Sections

Defined by:

```text
REPORT_SECTION_LABELS
```

Current sections:

- relationship signal profile
- future partner portrait
- Five Element love profile
- how you may recognize them
- likely meeting context
- pattern to release
- compatibility map
- timing window
- 30-day guidance
- closing message

Guardrail:

Do not remove `relationship_signal_profile` from required sections.

## Normalization

Model output is normalized before email rendering.

Key functions:

- `normalizeReportSections()`
- `reportValueToText()`
- `stringifySections()`
- `textToHtml()`

Why:

- model may return strings, arrays, objects, or nested content
- email renderer needs stable section title/body pairs
- text fallback must remain readable

Important line of logic:

```text
report.text = stringifySections(report.sections)
```

Keep generated text synchronized with normalized sections.

## Email Rendering

Key functions:

- `buildReportEmail()`
- `renderEmailSection()`
- `renderTimelineSection()`
- `parseTimelineNodes()`

Special handling:

- `30-Day Guidance` is rendered as timeline/checkpoint cards.
- Element banner image is selected with `elementBannerUrl()`.

Element banner assets:

```text
assets/elements/wood-banner.jpg
assets/elements/fire-banner.jpg
assets/elements/earth-banner.jpg
assets/elements/metal-banner.jpg
assets/elements/water-banner.jpg
```

## Stored Outputs

The Worker stores:

```text
report_json
report_text
report_html
```

This matters for retries:

- if report exists, reuse it
- do not generate a different report on retry
- only send email once

## Quality Guardrails

Output should:

- acknowledge uncertainty
- avoid destiny guarantees
- separate chemistry, consistency, and compatibility
- avoid diagnosing the user
- avoid clinical labels unless framed softly
- keep "reflective personal insight and entertainment" boundary

Output should not:

- promise a soulmate
- predict exact dates
- tell users to end/start relationships
- claim mental health advice
- expose scoring internals
- hallucinate unavailable product features

## New Product Reuse

For future products, reuse this pattern:

```text
answers
  -> deterministic scoring/profile
  -> model prompt with structured JSON requirements
  -> section normalization
  -> stored JSON/text/HTML
  -> idempotent email delivery
```

Do not rely on the model alone to decide the whole product logic. Put the interpretation backbone in deterministic code.
