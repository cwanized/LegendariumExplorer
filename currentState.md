# Current State

**Last Updated: 12. Juli 2026**

## Repository Status

First MVP is implemented and build-validated. Core genealogy data model (Beor lineage, Beren Erchamion) expanded. GUI architecture redesigned to use Primary/Secondary panel pattern.

The currently promoted remote state is:

- `origin/fb/core` at commit `c775540` (House of Beor lineage added to demo/testing)
- `origin/dev` at merge commit `c1bbb1c` (`Merge pull request #4 from cwanized/fb/core`)
- `origin/main` at merge commit `675af9a` (`Merge pull request #5 from cwanized/dev`)
- live GitHub Pages at `https://cwanized.github.io/LegendariumExplorer/`

The repository now contains the agreed top-level scaffold:

- app
- datasets
- PSModule
- docs
- scripts
- PRD
- PROMPT

## Authoritative Documents

- PRD/PRD-reviewed3.md: architecture source of truth
- PRD/PRD-reviewed4.md: implementation-start addendum
- PRD/setup3.md: repository setup and dataset-role rules
- PROMPT/prompt.md: implementation behavior contract

## Decisions Locked

- Identity is UUID-only.
- Canonical time format is `{ era, year } | null`.
- Biological graph validation is deterministic and fault tolerant.
- Over-parent handling ignores all biological_parent edges for the child.
- Cycle handling removes the highest lexicographic UUID edge and repeats until acyclic.
- Testing scenarios use a nested `expected` object.
- Each testing scenario declares `contract: true|false`.
- Marriage remains outside ELK layout input and is rendered either as an inline pair between canonical nodes or, when needed, as a deterministic spouse alias projection.
- Canonical Person metadata now includes optional `gender` and `species` fields.
- Canonical Person metadata now also supports ordered `sourceLinks` plus optional `portraitUrl`, `portraitSourceLabel`, and `portraitSourceUrl` fields.
- Dataset roles are now separated into `datasets/testing`, `datasets/demo`, and `datasets/prod`.

## MVP Status

Implemented:

1. App bootstrap in app with Vite, React, and TypeScript.
2. Canonical shared graph model in app/src/graph.ts.
3. Deterministic validation for missing references, self-parent edges, over-parent cases, and cycles.
4. Testing dataset seed with one contract scenario and one exploratory scenario, plus a separate valid demo showcase dataset and an empty prod dataset root.
5. First render path using ELK.js with deterministic fallback layout.
6. Warnings panel, search, click selection, shift-click two-person selection, and lowest common ancestor analysis.
7. Pan, zoom, reset view, and contract status surface in the UI.
8. PSModule manifest and module core for deterministic testing validation, dataset import, and dataset export helpers.
9. PSModule create commands for adding persons, marriages, and children into a persisted dataset.
10. App dataset switch between testing fixtures, valid demo showcase data, and the published prod dataset.
11. Demo showcase cleanup for the Earendil/Elwing branch by merging duplicate Elwing records into one canonical node.
12. Architecture docs now define spouse-side branch projection with one canonical continuation expanded by default and the opposite side collapsible by context.
13. Revised spouse rendering in the app: marriages already co-located on one generation band now stay as inline canonical pairs, while only cross-context marriages fall back to `Open line` companion alias cards.
14. Layout width tuning in the app: ELK horizontal node spacing, disconnected-component spacing, and fallback row spacing were increased so separate house starts and inline spouse pairs receive more horizontal room.
15. Inline marriage detection was corrected to use the actual gap between node boxes instead of raw X-coordinate distance, so wider house spacing no longer misclassifies Beren/Luthien, Dior/Nimloth, or Aragorn/Arwen as alias-projection cases.
16. PSModule now includes `New-LegendariumScenarioManifestSkeleton` to generate a deterministic scenario-manifest starter from the current dataset and `Test-LegendariumScenarioManifest` to verify that manifest person and relation references still exist.
17. The GUI now renders a top-right gender badge on every person card (`♂`, `♀`, or `?`), a detailed legend below the graph, and deterministic house-start anchor chips above the biological roots for each tagged house.
18. Demo and testing person fixtures now carry explicit `gender` values for the known Tolkien characters, so the new badge surface renders `♂` and `♀` instead of the fallback `?` for those entries.
19. House-start anchors now share one common top-row Y position across the graph instead of following the local height of each branch, so every house label starts from the same upper band.
20. The Tolkien fixtures now include Elros and connect both Elrond and Elros as children of Eärendil and Elwing; Elrond is no longer tagged with the `Half-elven` house and instead carries `Half-elven` as species metadata.
21. Biological child edges now render per parent-set as one shared connector: parent curves converge into a single junction, sibling groups share one horizontal bar, and only then fan out vertically to the children.
22. Demo and testing fixtures no longer treat `Half-elven` or `Reunited Kingdom` as houses for Arwen, Dior, and Eldarion, reducing misleading dashed house guides in the GUI.
23. Single-child nodes with two biological parents are now post-aligned to the parent midpoint, so the child box itself sits centered under the shared parent connector instead of only the connector doing so.
24. After single-child centering, same-generation marriages are post-aligned as inline pairs again, preserving a clean spouse gap and preventing fallback spouse-alias chips from reappearing.
25. The demo-only Elrond -> Eldarion `adoption` overlay was removed because it was fachlich incorrect and produced a misleading dashed social line in the showcase graph.
26. Person cards now expose a bottom-right source info trigger that opens a hover/click popover with authored source links, optional portrait metadata, and a best-effort preview of the primary source.
27. Source preview now follows the agreed MVP rule: only `sourceLinks[0]` is fetched for preview, the request times out quickly, and the UI falls back to the authored link list without blocking graph rendering.
28. The demo showcase people now carry explicit example `sourceLinks`, so the source popover behavior is visible and testable without synthetic UI-only fixtures.
29. Root `README.md` and `PSModule/README.md` now exist and document the current app, dataset roles, validation model, and exported PowerShell commands in English.
30. `Add-LegendariumPerson` and `Add-LegendariumChild` now accept structured `sourceLinks` plus optional portrait fields, so authored source and portrait metadata can be persisted without manual JSON editing.
31. The demo showcase now includes a small curated portrait subset for Aragorn and Elrond, each with explicit portrait provenance metadata.
32. The seeded demo portrait URLs were verified to resolve as image responses (`image/png` and `image/jpeg`), so the popover image slot is backed by real remote image assets instead of placeholder HTML links.
33. Eärendil now also carries an explicit Tolkien Gateway portrait in the demo dataset, using the direct image asset plus the media-view page as visible provenance.
34. The source popover now renders in a dedicated overlay layer at the end of the SVG, so it stays above person cards instead of being occluded by later node draws.
35. Demo and testing datasets now extend the Tolkien branch upward with Thingol and Melian as parents of Lúthien, and Tuor and Idril as parents of Eärendil, including marriage overlays for both parent pairs.
36. App asset and preview requests now derive from Vite `BASE_URL`, while the build base stays configurable through `VITE_BASE_PATH` so local root-based work remains the default and GitHub Pages-style subpath deploys can be built explicitly.
37. GitHub Actions builds now auto-derive the GitHub Pages project-site base path from `GITHUB_REPOSITORY`, and the repo now includes a Pages deployment workflow that publishes `app/dist`.
38. The Pages workflow now uses current major action versions and optionally auto-enables GitHub Pages when a `PAGES_ADMIN_TOKEN` repository secret is present; otherwise the repo must have Pages enabled once manually.
39. Runtime request paths no longer use `new URL(..., import.meta.env.BASE_URL)` because Vite `BASE_URL` is typically a path like `/LegendariumExplorer/`, not an absolute URL; dataset and preview requests now join that base as a plain path so the GitHub Pages app can boot correctly.
40. Root documentation now records the live GitHub Pages URL and the workflow now smoke-tests the built artifact for `index.html`, the root mount container, the emitted asset path, and copied demo dataset JSON before upload.
41. The live GitHub Pages deployment at `https://cwanized.github.io/LegendariumExplorer/` is now verified end-to-end by the user, including graph boot, popovers, and portrait image display.
42. Agreed branch flow for now is `fb/* -> dev -> main`, with direct commits allowed on `fb/*`, local integration testing on `dev`, and GitHub Pages deployments limited to `main` only.
43. A local `dev` branch has now been created from the current repository state, and the current uncommitted workflow/documentation changes are intentionally carried on that branch rather than being stashed.
44. A dedicated validation workflow now exists for `fb/*`, `dev`, and `main`, plus pull requests into `dev` and `main`, with stable required-check names `validate-frontend-build` and `validate-pages-path-build` prepared for branch protection.
45. The branch policy is now refined further: feature branches must use the `fb/` prefix, `dev` and `main` should require merge requests but not mandatory reviews for now, and `main` is expected to gain stricter required checks later than `dev`.
46. Demo and testing datasets now extend the Tuor branch one generation upward with Huor and Rían as biological parents of Tuor, including their marriage overlay and First Age birth/death dates.
47. The Tuor-parent dataset extension also required a follow-up JSON repair in demo and testing relations after one existing Elwing -> Elros relation object was accidentally split during insertion, which had caused the demo dataset to fail parsing in the browser.
48. The repaired Tuor-parent dataset slice has now been promoted through `dev` into `main`, and the live GitHub Pages deployment reflects that promoted state.
49. House of Beor lineage added to demo and testing datasets: Beor → Baran → Boron → Beren (the Elder) → Bregor → Barahir → Beren Erchamion, including marriage of Barahir and Emeldir as parents of Beren Erchamion (commit c775540).
50. The existing "Beren" record was clarified to "Beren Erchamion" with description "Son of Barahir, also known as Beren Erchamion" to distinguish from historical Beren (the Elder) now in the lineage.
51. GUI architecture redesigned with explicit Primary/Secondary panel separation: Secondary Panels (left/right sidebars for dev tools and quick stats) can be minimized/hidden; Primary Panels (Filter, Highlight/Analyzer, Inspector, Search) are always accessible within the Canvas area, minimizable to chip buttons but never fully hidden.
52. Four-state GUI mockup created (`docs/mocks/gui-architecture-v1.drawio`): Standard Layout (panels expanded), Minimized (chips visible), Fullscreen (secondary hidden, primary as chips), and Info (architecture reference).
53. Primary panel naming clarified: "Selection & LCA Analysis" replaces vague "Highlight & Analyze", with concrete content (1/2 person selection, LCA result with ancestor name, fade-unrelated toggle, export path action).

## Validation Status

- app build passes via npm run build in app/
- touched TypeScript and JSON files report no current diagnostics
- PSModule import plus Invoke-TestingValidation passes the contract scenario
- PSModule legacy `Invoke-DemoValidation` and `Export-DemoDataset` remain as compatibility wrappers around testing fixtures
- app build output now includes datasets under dist/datasets/testing, dist/datasets/demo, and dist/datasets/prod
- testing validation still passes after preserving the mixed regression fixture set under datasets/testing
- browser retest on the fresh 5176 dev server confirms dataset switching works across all three roles: testing shows warnings plus contract pass, demo shows the clean 12-person showcase with zero warnings, and prod starts empty
- app build passes after introducing spouse projection rendering and optional `gender`/`species` person metadata support
- browser retest on the fresh 5174 dev server confirms Beren/Luthien and Dior/Nimloth no longer render duplicate companion cards, while cross-context pairs such as Earendil/Elwing still retain alias projection where needed
- browser retest after widening the layout confirms a larger horizontal gap for inline pairs such as Beren/Luthien and more separation between disconnected house starts
- browser retest on the fresh 5175 dev server confirms only Earendil/Elwing still render as alias projection; Beren/Luthien, Dior/Nimloth, and Aragorn/Arwen now remain inline-only after the inline-gap fix
- PSModule manifest helpers validate cleanly against datasets/testing: `Test-LegendariumScenarioManifest` reports zero missing references and `New-LegendariumScenarioManifestSkeleton -Contract` emits one deterministic scenario skeleton with status `warning` and 6 ignored relations matching the current testing fixtures
- app build passes after adding the gender badges, house-start anchors, and the richer graph legend
- browser retest after dataset refresh confirms the demo graph now exposes 12 gender badges with only `♂` and `♀`, no fallback `?`, because the known demo people now include explicit `gender` metadata
- app build passes after aligning all house anchors to a shared top row and extending the Tolkien branch with Elros plus the Eärendil/Elwing parent edges to Elrond and Elros
- browser retest on the shared 5176 page confirms all current house labels render on the same top-row baseline and that both `Elrond` and `Elros` are present in the refreshed demo graph
- app build passes after switching biological lineage rendering from per-relation straight lines to grouped parent-set child connectors
- browser retest on the shared 5176 page confirms the active house labels are now limited to `Thingol`, `House of Beor`, `Hador`, and `Dunedain`, while Arwen, Dior, Elrond, and Elros expose `Half-elven` only as species metadata instead of as house anchors
- app build passes after centering single-child nodes such as Dior under the midpoint of their biological parents
- app build passes after the follow-up inline-marriage realignment; browser retest on the shared 5176 page shows zero spouse chips and a centered Dior with Nimloth, Elwing with Eärendil, and Arwen with Aragorn restored as inline-only pairs
- app build passes after removing the incorrect demo adoption edge from Elrond to Eldarion, and the refreshed demo graph no longer shows that dashed overlay line
- app build passes after adding source-link metadata support, the person source popover, and the best-effort primary-source preview endpoint
- app build passes after making dataset and source-preview requests base-path aware for configurable subpath deployments
- app build passes both locally and in a simulated GitHub Actions project-site environment without manually setting `VITE_BASE_PATH`
- app build passes again after repairing the malformed demo/testing relations JSON that had blocked browser parsing of the demo dataset
- GitHub Pages workflow was updated to current action majors and to support optional auto-enable through `PAGES_ADMIN_TOKEN`; remote validation still depends on repository-side Pages permissions and settings
- GitHub Pages runtime failure `Failed to construct 'URL': Invalid base URL` was fixed locally by switching request-path construction from URL-base resolution to path joining against `BASE_URL`
- GitHub Pages now runs successfully at the live project-site URL, and the workflow includes a pre-upload smoke test to catch missing dist assets earlier
- user verification confirms the live GitHub Pages app loads successfully and still shows working popovers plus preview images
- live GitHub Pages now also confirms the promoted Huor and Rían dataset extension after the `dev -> main` merge
- branch promotion strategy is now explicitly defined: `fb/*` for direct work, `dev` for local integration, `main` for release and Pages deploys
- branch naming is now fixed to the `fb/` prefix for direct feature work, with no mandatory reviews yet on `dev` or `main`
- remote promotion is now current through `main`; local branches on any workstation should be treated as potentially stale until refreshed with `git fetch --all --prune` plus `git pull --ff-only` on the branch you want to continue from
- CI now supports the intended branch flow without adding a second remote preview surface: `fb/*`, `dev`, and `main` all validate, while GitHub Pages still deploys from `main` only
- PowerShell roundtrip validation now confirms that authoring commands persist `sourceLinks`, `portraitUrl`, `portraitSourceLabel`, and `portraitSourceUrl` into a temporary prod dataset without touching the repository dataset roots

## Immediate Next Slice

The next implementation slice should cover:

**GUI Refactor (High Priority):**
1. Implement Primary/Secondary panel architecture in `app/src/App.tsx`.
2. Create `ExplorePanel` component (Filter + Search docked).
3. Create `AnalyzerPanel` component (Selection + LCA Analysis).
4. Create `InspectorPanel` component (Info/Relations/Sources/Stats tabs).
5. Create `DevToolsPanel` component (Dataset switcher, Contract, Warnings — secondary, collapsible).
6. Implement chip-button minimize behavior for all primary panels.
7. Implement fullscreen mode with hidden secondary sidebars.
8. Add CSS transitions for panel expand/collapse.

**Data & Validation:**
9. Add automated tests for validation determinism, contract scenario evaluation, manifest helpers, and source-link schema persistence.
10. Review House of Beor lineage data against TolkienGateway or other canonical sources for accuracy.
11. Consider adding more House of Beor context (Haleth-related persons, other Edain houses).

**Later (Defer):**
12. Improve chunk size and bundle strategy around the graph stack, but defer this until a later optimization pass because current local and GitHub Pages behavior is functionally correct.
13. Decide whether app and PSModule should share one exported validation core.
14. Decide whether prod authoring should remain direct or whether a separate unpublished working dataset tier is needed later.
15. Decide whether prod should gain its own optional scenario manifest once published fixtures stabilize.
16. Refine the inline-pair versus alias-projection rule for harder cases such as multiple marriages on the same generation band.
17. Expand the curated demo portrait subset only after explicitly reviewing any further external image sources.
18. Refine spouse projection for more complex cases such as multiple marriages and branch ownership beyond the current single-pair MVP heuristic.
19. Decide later whether `dev` should gain its own remote preview path or remain local-only while `main` stays the sole GitHub Pages target.
20. Apply GitHub branch protection rules for `dev` and `main` using the now-prepared validation check names, with no mandatory reviews initially.
21. Decide later which stricter checks should become `main`-only requirements beyond the current shared validation baseline.

## Workstation Handover

Use this as the minimum restart context on another machine:

1. The release currently live on GitHub Pages is the `main` branch state at `https://cwanized.github.io/LegendariumExplorer/`.
2. The Pages path is case-sensitive; the working URL uses `/LegendariumExplorer/`.
3. `dev` already contains the integrated `fb/core` work and was promoted into `main`.
4. The most recent content change promoted through the flow is the Tuor upward extension with Huor and Rían, plus the JSON repair required to keep demo/testing relations parseable.
5. Only `main` deploys remotely; `dev` remains an integration branch without a separate Pages preview.
6. Frontend commands are run from `app/`, not from the repository root.

Recommended resync commands on another workstation:

```powershell
git fetch --all --prune
git switch main
git pull --ff-only
git switch dev
git pull --ff-only
```

If continuing feature work, branch from the refreshed baseline:

```powershell
git switch dev
git switch -c fb/<next-slice>
cd app
npm install
npm run dev
```

## Pending Todos

1. Remove redundant birth-date storage between Person.birth and biological_parent relation attributes.date.
2. Choose one canonical source for child birth timing so future edits do not require keeping duplicate values in sync.
3. Update Add-LegendariumChild so it writes the canonical birth value only once instead of mirroring it into both the person and the parent relations.
4. Implement deterministic expand/collapse for spouse-side continuation so the same descendant subtree is not fully duplicated under both spouse contexts.
5. Resolve the existing browser console issue around passive wheel listeners during graph zoom.
6. Keep the embedded PowerShell seeded dataset aligned with the on-disk demo/testing fixtures when person metadata evolves.

## Notes

- Prefer warning-plus-continue behavior over hard failures.
- Do not introduce heuristic data repair.
- Keep validation outputs deterministically sorted.
- Vite now serves `datasets/testing`, `datasets/demo`, and `datasets/prod` through /datasets/* and copies all three into the production build.
- datasets/prod starts as an empty but valid published-dataset placeholder with empty index files and an empty scenario manifest.
- datasets/testing preserves the previous mixed regression fixture set, while datasets/demo contains only the current valid visual showcase branch set.
- The Earendil/Elwing demo showcase branch now uses one Elwing id for both marriage and biological lineage; the previous duplicate Elwing node was removed from the valid showcase dataset.
- PRD and prompt now distinguish between inline canonical pairs and branch-local spouse alias projection while keeping biological_parent edges as the sole layout input.
- The current app behavior prefers inline canonical pairs whenever both spouses are already visible on the same generation band; only cross-context marriages use companion alias cards with deterministic branch ownership.
- Inline-versus-alias classification now uses the real box gap on the same generation band, not the raw left-edge delta, which keeps the rule stable when ELK spacing changes.
- The current ELK tuning also spaces disconnected components and same-band nodes more aggressively, which reduces cramped inline spouse pairs without reintroducing duplicate pair projections.
- Source preview is intentionally best-effort through the local Vite server path; when no preview is available quickly, the UI still shows the authored links and keeps the graph interactive.
- Local work should continue with the default root base path; GitHub Actions now derives the project-site subpath automatically, while `VITE_BASE_PATH` remains available for explicit overrides.
- A repository that has never enabled Pages before will still need either one manual Pages activation in GitHub or a `PAGES_ADMIN_TOKEN` secret because the default `GITHUB_TOKEN` cannot perform that admin enablement step.
- Desired GitHub governance is direct commits on `fb/*`, while `dev` and `main` should later be protected to accept changes only through pull or merge requests.
- Initial GitHub governance should not require reviews yet, but should enforce merge-request-only updates on `dev` and `main`; stricter checks are expected to arrive on `main` later.
- Remote `dev` preview remains intentionally unimplemented for now because the repository already uses the single GitHub Pages project site for `main`, and the user prefers local integration testing over artifact-only previews.
- The correct live GitHub Pages URL is `https://cwanized.github.io/LegendariumExplorer/`; the lowercase `/legendariumexplorer/` path returns 404.