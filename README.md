# Legendarium Explorer

Legendarium Explorer is a deterministic genealogy viewer for Tolkien-oriented lineage data. The current repository contains a Vite/React/TypeScript frontend, static JSON datasets for three roles, and a PowerShell module for dataset import, validation, and authoring.

The project treats biological lineage as the only layout input. Social relations such as marriage, mentorship, adoption, and step-parent links stay outside the ELK layout graph and are rendered as overlays or spouse-side projections. Invalid input is handled with warnings and deterministic edge suppression instead of best-guess repair.

## Repository Layout

- app: frontend application and build pipeline
- datasets/testing: regression fixtures, invalid cases, and scenario contracts
- datasets/demo: valid showcase data for UI review
- datasets/prod: published dataset placeholder
- PSModule: PowerShell authoring and validation tooling
- PRD: architecture and setup source-of-truth documents
- PROMPT: implementation behavior contract
- currentState.md: running handoff and operational status

## Authoritative Documents

- PRD/PRD-reviewed3.md: architecture source of truth
- PRD/PRD-reviewed4.md: implementation-start addendum
- PRD/setup3.md: repository structure and dataset-role rules
- PROMPT/prompt.md: implementation contract

## Frontend Features

- Deterministic validation for missing references, self-parent edges, over-parent cases, and cycles
- ELK-based biological layout with deterministic fallback layout
- Search, selection, two-person lowest-common-ancestor analysis, pan, zoom, and reset view
- Inline same-generation spouse pairing plus cross-context spouse projection where needed
- House-start anchor chips and grouped biological child connectors
- Gender badges on person cards
- Source info trigger on person cards with:
  - authored source-link list
  - optional portrait display when portrait metadata is present
  - best-effort primary-source preview fetch with a 4-second timeout
  - fallback to plain links when preview data is unavailable

## Person Metadata

The frontend currently supports these optional descriptive fields on person records:

- gender
- species
- sourceLinks
- portraitUrl
- portraitSourceLabel
- portraitSourceUrl

`sourceLinks` is an ordered array. The first entry is the primary source used for the source popover and preview request. Links must be authored explicitly in JSON; the app does not derive Tolkien Gateway URLs from names.

Portraits are optional. If a person has `portraitUrl`, the popover shows the image and its provenance when `portraitSourceLabel` and `portraitSourceUrl` are present.

## Dataset Roles

### testing

Use this for deterministic regression fixtures, invalid edge cases, cycle tests, and scenario manifests.

### demo

Use this for a clean showcase graph. It should stay valid and presentation-friendly.

### prod

Use this for the published dataset. It starts empty and must remain valid even when no records exist yet.

## Running the App

From app:

```powershell
npm install
npm run dev
```

Build validation:

```powershell
npm run build
```

The app reads dataset JSON through `/datasets/<role>/...` paths served by Vite in development and copied into `dist/datasets` during build.

## Source Preview Behavior

The source popover attempts a best-effort preview fetch for the primary source through a Vite middleware endpoint. This is a convenience feature, not a hard dependency.

Important behavior:

- graph rendering must not depend on preview success
- preview requests time out quickly and fall back to the authored links
- static deployments without the preview middleware still retain the link-list fallback

## PowerShell Module

The repository includes a local PowerShell module under PSModule.

Typical import:

```powershell
Import-Module .\PSModule\LegendariumExplorer.psd1 -Force
```

The module covers dataset import, validation, lookup, seeded export helpers, and basic authoring for persons, marriages, and children. See PSModule/README.md for examples and command details.

## Current Gaps

PSModule authoring now supports structured `sourceLinks` plus optional `portraitUrl`, `portraitSourceLabel`, and `portraitSourceUrl` values for person and child creation.

- `Add-LegendariumChild` still mirrors birth timing into both the child record and biological_parent relation attributes
- source preview is intentionally best-effort and may fall back to links when remote sites do not yield usable metadata quickly

## Validation

The current source/portrait slice is build-validated with:

```powershell
cd app
npm run build
```