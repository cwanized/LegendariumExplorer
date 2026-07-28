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

- `gender` (string: "male", "female", or other; displays as ♂, ♀, or ?)
- `species` (string: "Half-elven", "Elf", "Human", etc.)
- `sourceLinks` (array of { label, url })
- `portraitUrl` (string URL to portrait image)
- `portraitSourceLabel` (string: attribution label for the portrait)
- `portraitSourceUrl` (string: URL to portrait provenance/source)

### sourceLinks Behavior

`sourceLinks` is an **ordered array**. The first entry (`sourceLinks[0]`) is the **primary source** used for:

1. **Source popover display** - shown when clicking the info icon on a person card
2. **Preview metadata fetch** - the app attempts to fetch preview metadata from `sourceLinks[0].url` with a **4-second timeout**
3. **Best-effort rendering** - if preview fetch fails or times out, the UI falls back to displaying the authored source link list without blocking graph rendering

Links must be authored explicitly in JSON; the app does not derive Tolkien Gateway URLs from names or make any automatic URL generation.

Example:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "name": "Aragorn II",
  "sourceLinks": [
    {
      "label": "Tolkien Gateway",
      "url": "https://tolkiengateway.net/wiki/Aragorn"
    },
    {
      "label": "Lord of the Rings Wiki",
      "url": "https://lotr.fandom.com/wiki/Aragorn"
    }
  ]
}
```

### Portrait Behavior

Portraits are optional. If a person has `portraitUrl`, the source popover:

1. **Loads and displays** the image from the provided URL
2. **Shows provenance** when `portraitSourceLabel` and `portraitSourceUrl` are present (as a link to the source page)
3. **Falls back gracefully** if the image URL is unreachable or invalid

Example:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440003",
  "name": "Elrond",
  "portraitUrl": "https://example.org/elrond-portrait.png",
  "portraitSourceLabel": "Tolkien Gateway",
  "portraitSourceUrl": "https://tolkiengateway.net/wiki/Elrond"
}
```

## House Definitions

Each dataset may include a `house-definitions.json` file. This file controls which houses are allowed to create visible house anchors in the UI.

Rules:

- `Person.houses` remains the membership tag on the person record
- a house only becomes an anchor if it exists in `house-definitions.json`
- if a house has no definition, it does not create an anchor

Recommended v1 fields per house definition:

- `houseId`
- `displayName`
- `aliases` optional
- `tier` (`start` or `later`)
- `anchor.enabled`
- `anchor.order`

In v1, only houses with `tier: "start"` and `anchor.enabled: true` are treated as visible root anchors.

Current planned start houses:

- Elben: Vanyar, Noldor, Teleri
- Menschen: die 3 Häuser der Edain
- Zwerge: die 7 Väter der Zwerge

Later houses such as Dunedain stay defined but do not create root anchors.

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

GitHub Pages deployment is supported through the repository workflow in .github/workflows/deploy-pages.yml. On GitHub Actions, the app automatically derives the project-site base path from `GITHUB_REPOSITORY` unless `VITE_BASE_PATH` is explicitly set.

Current live deployment:

- https://cwanized.github.io/LegendariumExplorer/

Important:

- the GitHub Pages URL is case-sensitive; use `/LegendariumExplorer/`, not `/legendariumexplorer/`
- the current live deployment already includes the Huor and Rian/Tuor branch extension plus the follow-up JSON repair

Deployment notes:

- local development remains rooted at `/`
- GitHub Pages is published from `main` only
- GitHub Pages project-site builds automatically use the repository subpath
- portrait images continue to load on GitHub Pages because they are fetched directly by the browser
- source preview metadata remains best-effort and may still fall back to the authored source links

## Branching And Promotion

Current intended flow:

- `fb/*`: direct feature work, local commits allowed, always using the `fb/` prefix
- `dev`: local integration branch for merged feature work before release promotion
- `main`: release branch and the only branch that deploys to GitHub Pages

Recommended usage:

- develop and test on `fb/*`
- merge `fb/*` into `dev` and test the merged integration state locally
- promote `dev` into `main` only after the integrated local state is acceptable
- protect `dev` and `main` in GitHub so they accept changes only through pull or merge requests

This keeps GitHub Pages simple while still giving one branch for integrated pre-release validation.

Prepared CI support for that flow:

- `.github/workflows/validate-branches.yml` runs on pushes to `fb/*`, `dev`, and `main`
- the same workflow also runs on pull requests targeting `dev` or `main`
- it currently enforces two checks:
  - `validate-frontend-build`
  - `validate-pages-path-build`

Recommended GitHub branch protection:

- `fb/*`: no protection, direct commits allowed
- `dev`: require pull request or merge request, no mandatory review for now, require the two validation checks above
- `main`: require pull request or merge request, no mandatory review for now, require the two validation checks above initially, and allow stricter checks later, while keeping GitHub Pages deployment sourced from `main` only

Why no dedicated remote `dev` preview right now:

- GitHub Pages can publish only one project site per repository cleanly
- a downloadable build artifact from CI would only be useful if you wanted someone else to fetch and inspect a packaged build manually
- because you already plan to validate `fb -> dev` locally, an artifact-only preview adds little value at the moment

## Current Promotion Status

At the time of this handover:

- `origin/dev` already contains the merged `fb/core` work, including the Huor and Rian/Tuor dataset extension and the follow-up JSON repair
- `origin/main` has already been promoted from `dev`
- GitHub Pages is serving the promoted `main` state at the live URL above
- `main` remains the only deploy branch; `dev` is an integration branch and does not publish a separate remote preview

## Continue On Another Workstation

Recommended sync steps:

```powershell
git fetch --all --prune
git switch main
git pull --ff-only
git switch dev
git pull --ff-only
git switch fb/<your-next-slice>
```

If the next session is for local UI work, run the frontend from `app/`:

```powershell
cd app
npm install
npm run dev
```

Notes for seamless continuation:

- use `main` when you want the currently deployed release baseline
- use `dev` when you want the current integrated pre-release baseline
- create new work on `fb/*`, then promote `fb/* -> dev -> main`
- the app build/serve commands belong in `app/`; running `npm run dev` from the repository root is not the intended path
- `currentState.md` is the operational handover document and should be refreshed whenever branch/deploy state materially changes

Important first-use note for GitHub Pages:

- the repository must already have GitHub Pages enabled once, or
- you must add a repository secret named `PAGES_ADMIN_TOKEN` so the workflow can enable Pages automatically

`PAGES_ADMIN_TOKEN` must be a token with sufficient repository administration and Pages write permissions. Without that secret, the workflow can deploy only after Pages has been enabled for the repository.

Optional deploy base path:

```powershell
$env:VITE_BASE_PATH = '/LegendariumExplorer/'
npm run build
```

Leave `VITE_BASE_PATH` unset for normal local development and local preview at `/`.

The app reads dataset JSON through `/datasets/<role>/...` paths served by Vite in development and copied into `dist/datasets` during build.

## Source Preview Behavior

The source popover attempts a best-effort preview fetch for the primary source through a Vite middleware endpoint. This is a convenience feature, not a hard dependency.

Important behavior:

- graph rendering must not depend on preview success
- preview requests time out quickly and fall back to the authored links
- static deployments without the preview middleware still retain the link-list fallback
- GitHub Pages project-site builds derive that subpath automatically in GitHub Actions
- `VITE_BASE_PATH` remains available as an explicit override for custom subpaths or non-GitHub CI
- if the repository has never had Pages enabled, `actions/configure-pages` cannot auto-enable it with the default `GITHUB_TOKEN`

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

The GitHub Pages workflow also runs a small smoke test against the built artifact before upload, including checks that `index.html` exists, the root mount container is present, the built asset path is emitted, and the demo dataset JSON was copied into `dist/datasets`.