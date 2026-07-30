# Artifact Archive — 2026-07-12

The Harness cleanup moved non-runtime deliverables out of the active source and memory paths without deleting user-created content.

## Preserved moves

| Previous active path | Local archive path | Approximate size | Classification |
| --- | --- | ---: | --- |
| `assets/social/` | `artifacts/archive/2026-07-12/assets/social/` | 1.3 GB | Dated social packs, renderers, MP4/PNG/JPG, ZIP, QA, notes |
| `assets/meta-low-risk/` | `artifacts/archive/2026-07-12/assets/meta-low-risk/` | 33 MB | May 2026 ad exports and renderers |
| `demo/` | `artifacts/archive/2026-07-12/demo/` | 3.3 MB | Lemon Squeezy demo renders and generator |

The archive is ignored by Git and routine search. It remains on this machine for restoration or deliberate reuse. A blob-for-blob audit against pre-cleanup capture `888e498d…` matched `265/265` files with no missing, changed, or extra blobs.

This is a verified local move, not an off-machine backup: a fresh clone cannot restore the ignored archive. Copy it to an approved durable storage location before relying on it as backup.

## Known duplication

The following two archived ZIP files have the same SHA-256 hash and content:

- `your-love-element-meta-20260612-daily-pack.zip`
- `your-love-element-meta-20260614-daily-pack.zip`

Both were preserved because this cleanup chose reversibility over deletion. A later maintenance task may remove one with explicit approval.

## Removed caches

Only non-content cache/metadata was deleted:

- `.DS_Store`
- `__pycache__/`
- `*.pyc` / `*.pyo`

## Restore policy

Do not move the whole archive back into `assets/`. For a new campaign or social task, restore only the required source renderer/copy into an explicitly named working area, generate outputs under `artifacts/`, run the media QA gate, and mark any new release in current state.
