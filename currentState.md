# Current State

**Last Updated: 19. September 2026**

## R3B Handover Status (19. September 2026)

Current active branch:

- `fb/r3b-core`

Relevant recent branch/commit state:

- `fb/r3b-core` contains:
	- `97ad298` `docs(r3b): add frs v1 and implementation plan`
	- `8ea1987` `feat(r3b): add initial mode and layout slices`
- `preview3-hard-grid-raster` remains the pre-R3B baseline at `5b81373` (`after clean up, stable`)
- `fb/person-tile-styles-preview3` contains the separate person-tile demo/style work
- One stash still exists on the person-tile branch:
	- `stash@{0}`: `person-tile-preview3-split`

Current R3B document anchors:

- `PRD/TREE_LOGIKUPDATE/R3B-FRS-V1.md`
- `PRD/TREE_LOGIKUPDATE/R3B-implementation-plan.md`

What is already implemented on `fb/r3b-core`:

- R3B exists as a separate selectable Preview3 mode.
- R3B has its own namespace under `app/src/preview3/r3b/`.
- Slice 1 is in place: separate mode wiring and separate pipeline entry.
- Slice 2 is in place: separate R3B spouse-projection handling and parent-anchor selection.
- Slice 3 is in place: separate R3B layout path with asymmetric multi-marriage placement (`first left`, `second right`, `further right`) and intentionally reduced post-layout correction budget.
- Slice 4 progressed substantially: R3B-specific render derivation for house anchors and biological child groups now consumes R3B artifacts instead of reconstructing them loosely from generic render state.
- House-subtree offsets are now active in modeR3B, but without double-applying vertical house `yOffset`; generation seeding remains the source of the vertical house offset behavior.
- R3B now keeps a central projection-placement resolver under `app/src/preview3/r3b/projections.ts` and explicit projection-placement decision metadata under `app/src/preview3/r3b/types.ts`.
- R3B now carries early `visibleParentSlotsByFamily` artifacts in placement state. These slots are already used in the placement core for visible family midpoint / child-axis decisions.
- Several targeted local core rules are now in place and green-validated:
	- Hurin / Morwen child-band and Hurin / Huor projection corridor stabilization
	- Elrond / Elros spacing plus Elros -> Vardame vertical alignment
	- Aragorn / Arwen projection no longer overlapping Vardame
	- final same-row de-overlap after later horizontal family passes
	- dense same-row cousin separation for the Finwe / Feanor / Fingolfin / Finarfin descendant class via local subtree compaction + local cousin-gap enforcement
	- Feanor descendant row now reads as a compact sibling cohort with a larger first-cousin gap instead of interleaving with Fingolfin descendants
	- parentless partner projections (current verified examples: Celeborn / Galadriel, Eol / Aredhel, Elenwe / Turgon) now stay local to the anchored branch instead of drifting far outward on the same horizontal lane

Current uncommitted work on `fb/r3b-core`:

- modified: `currentState.md`
- modified: `app/src/App.tsx`
- modified: `app/src/preview3/r3b/placement.ts`
- modified: `app/src/preview3/r3b/projections.ts`
- modified: `app/src/preview3/r3b/renderModel.ts`
- modified: `app/src/preview3/r3b/types.ts`
- modified: `app/tests/r3b-smoke.spec.ts`

Current validation status:

- `npm run build` in `app/` is green on the current local R3B core state.
- `npx playwright test -c playwright.r3b.config.ts` is green with 11/11 tests on the current local R3B smoke suite.
- Important workflow note: for manual browser review on `http://127.0.0.1:4173/preview3`, rebuild first; otherwise Vite preview can still serve an older bundle than the last Playwright run.

Important current product/architecture decisions for the next agent:

- `genealogytree.pdf` is a technical reference for family-tree representation patterns, but the R3B FRS is the binding project-specific source of truth.
- In R3B, spouse projection is the default for marriage contexts.
- Projection suppression is allowed only for explicit special cases, notably local clean inline cases such as Silmarien/Elatan.
- R3B is intended to become a separate implementation, not just a permanent alias of R3.
- Current architecture assessment: projection as a concept is still considered correct, but its placement is too late in the pipeline. The next larger intended direction is to move from `projection derived after layout` toward `projection-aware family placement`, where visible partner slots are part of early placement rather than mostly repaired later.

Most important current finding about visual quality:

- The current R3B overall appearance is materially improved over the earlier `fb/r3b-core` checkpoint, and the former dense same-generation Feanor/Fingolfin/Finarfin interleaving problem is now locally controlled.
- The hard overlap problem in R3B is largely reduced. The current remaining spacing issue has shifted one level upward: some upper-family reservations are still wider than visually ideal, especially the gap before the leftmost Finarfin child block (`Aredhel -> Finrod`) even though both local sibling cohorts are now compact.
- A broad same-row family-gap pass was tried and explicitly rejected because it reopened already-green Hurin/Rian and Elrond/Celebrian cases.
- The preferred direction remains: local explicit core rules, not global post-filters.
- The former major projection-drift class is now improved locally: current verified projection gaps for Turgon/Elenwe, Aredhel/Eol, and Galadriel/Celeborn are back down to a local 28px class instead of large same-row outward drift.
- New current projection-quality note: the local projection fix trades large horizontal drift for a denser local packing pattern. In visually busy zones (current screenshot class around Fingolfin / Earwen / Luthien / projected Beren and projected Finarfin) projections can now remain semantically local but still feel too tightly stacked.
- This means the primary open projection issue is no longer `drift too far away`, but `local projection packing is too dense / not distributed intelligently enough`.

What R3B currently already respects versus not yet:

- already respected:
	- person ordering through shared R3 ordering helpers
	- house `anchor.order` through shared cluster helpers
	- house `layout.yOffset` as seeded generation/row input through shared generation helpers
- already newly respected:
	- visible family midpoint from early `visibleParentSlotsByFamily` artifacts in placement
	- projection-first local spouse corridors for the validated Hurin / Huor and Aragorn / Arwen classes
	- Elros / Vardame local vertical single-parent alignment
	- compact same-row sibling cohorts with explicit larger cousin gap in the Feanor descendant row class
	- local partner-projection locality for the current Celeborn / Eol / Elenwe regression class
- not yet active in modeR3B:
	- `applyHouseSubtreeVerticalOffset`
	- `applyHouseOrderXResolution`
	- broader disconnected-component or global stabilization passes
	- a broader generic upper-family span tightening rule for visually oversized inter-family reservations
	- a smarter local projection-packing rule that can spread nearby projections in a small local search area instead of only stacking them tightly in a narrow vertical lane cluster

Recommended next working mode:

- Keep working from concrete visual examples and classify whether the issue is:
	- sibling spread
	- child-band centering
	- cluster spacing
	- house-anchor/house-cluster positioning
	- projection/suppression policy
- The former primary dense-row sibling/cousin cohort issue is improved locally and should now be treated as green for the Feanor-row regression case.
- The current primary unresolved categories are:
	- upper-family / family-span reservation being wider than visually ideal (`Aredhel -> Finrod` class)
	- overly dense local projection packing in busy branches even when projection locality is correct (`Fingolfin / Earwen / Luthien / projected Beren` screenshot class)
	- broader architectural mismatch: projection need is known from tree semantics early, but final projection placement is still partly deferred until after main node placement

Recommended next implementation priorities after visual feedback:

1. Keep the current green R3B baseline stable and avoid broad new global end-passes.
2. Continue using early `visibleParentSlotsByFamily` in the placement core before expanding their direct render-model authority again.
3. Next preferred spacing slice: tighten oversized upper-family reservations in the initial R3B family-span/child-span heuristics rather than adding another broad same-row pass. The current concrete class to follow is the large `Aredhel -> Finrod` gap, which appears to come from upstream family/subtree span reservation, not from the new cousin-gap pass.
4. Next preferred projection-quality slice: improve local projection packing so nearby projections can choose among several local candidate slots instead of only a narrow vertical lane stack. The current concrete screenshot class to follow is Fingolfin / Earwen / Luthien with projected Finarfin and projected Beren.
5. Next larger handover-ready architecture adjustment to pursue: move from `projection derived after layout` toward `projection-aware family placement`, where the need for projection and its visible slot are treated as first-class placement artifacts earlier in the R3B pipeline rather than primarily post-placement render heuristics.
6. If that larger adjustment is pursued, the expected optimization targets in the same conversion are:
	- shrink or remove most of the current projection-collision clearance logic in `app/src/preview3/r3b/projections.ts`
	- reduce the need for projected corridor / projected row cleanup passes in `app/src/preview3/r3b/placement.ts`
	- make `visibleParentSlotsByFamily` the authoritative placement/render contract instead of a partly heuristic intermediate
	- stabilize child-band centering against the final visible parent geometry so later re-centering passes can become smaller
	- keep only narrow fallback heuristics for true exceptional collisions instead of using them as the primary slot-finding mechanism
7. Only after those local slices or the larger projection-aware conversion reconsider whether any former R3 stabilization behavior should return as an explicit, local R3B core rule.

Handover-ready multi-slice migration plan for the projection-aware conversion (the 10-point direction should be treated as intended scope, even if execution is split across more than 3 slices):

1. Slice A - projection requirement model:
	- introduce an explicit early artifact for `projection requirements` / `visible partner slots` per family or marriage
	- each requirement should at least encode: owner, companion, preferred side, slot class, policy / reason, and whether the slot is mandatory for visible family geometry
	- primary covered goals:
		- visible partner slots as first-class artifacts
		- projection demand decided early per relationship
		- special cases moved into explicit policy rather than scattered late heuristics

2. Slice B - authoritative visible parent slot contract:
	- replace the current partly heuristic `visibleParentSlotsByFamily` role with an authoritative placement/render contract
	- placement, render-model derivation, and connector preparation should all consume the same slot artifact instead of recomputing similar projection geometry independently
	- primary covered goals:
		- placement/render artifact convergence
		- visible slot contract becomes stable input rather than a derived convenience value

3. Slice C - family-axis and child-band placement on visible slots:
	- compute family midpoints and child-band anchor decisions directly from the authoritative visible parent slots
	- use these slots during initial placement instead of relying on later recentering to compensate for post-hoc projection movement
	- primary covered goals:
		- family axes derived from final visible parent geometry
		- child placement becomes projection-aware from the start

4. Slice D - sibling / cousin spacing on projection-aware families:
	- refit the current local sibling-compaction and cousin-gap rules to operate on families whose visible parent geometry already includes projection slots
	- verify that compact sibling cohorts and cousin separation still work once projection-aware placement is introduced earlier
	- primary covered goals:
		- sibling/cousin rules stay compatible with projection-aware family placement
		- partner locality no longer fights later spacing passes

5. Slice E - upper-family span tightening:
	- revisit family-span and child-span reservation once visible partner slots are authoritative
	- the current concrete class to follow remains the upstream oversized reservation around `Aredhel -> Finrod`
	- primary covered goals:
		- reduce oversized upper-family reservation
		- let visible slot geometry inform subtree span more directly

6. Slice F - local projection packing search:
	- replace the current narrow vertical-lane local fallback with a small local candidate search / scoring strategy
	- goal is to keep projections local without creating visually cramped stacks in busy zones
	- current concrete screenshot class remains Fingolfin / Earwen / Luthien with projected Finarfin and projected Beren
	- primary covered goals:
		- local projection packing becomes deliberate, not just first-free vertical stacking
		- projection density is optimized without reintroducing far drift

7. Slice G - projected corridor / row cleanup reduction:
	- once authoritative projection-aware placement exists, shrink or remove the current projected corridor / projected row cleanup passes that were mainly compensating for late projection placement
	- primary covered goals:
		- reduce placement repair passes
		- keep only narrow explicit guardrails where still needed

8. Slice H - projection resolver reduction in render stage:
	- reduce `app/src/preview3/r3b/projections.ts` from a primary slot-finding system to a fallback / finalization layer
	- any remaining collision handling should be treated as an exception path rather than the normal projection-placement path
	- primary covered goals:
		- collapse late projection repair complexity
		- keep render-time resolution narrow and deterministic

9. Slice I - connector-model simplification:
	- once visible slots and parent anchors are stable earlier, simplify parent-anchor selection and connector derivation to trust those artifacts directly
	- primary covered goals:
		- connector preparation becomes simpler and more deterministic
		- less duplication between placement-time visible geometry and render-time connector logic

10. Slice J - final cleanup and policy audit:
	- after the migration, audit which earlier local heuristics are now obsolete, which remain valid as guardrails, and which R3 carryovers should still stay out of R3B
	- primary covered goals:
		- retain only intentional narrow fallbacks
		- prevent the new projection-aware model from accreting legacy repair logic again

Current recommended execution order:

1. Start with slices A-C to establish the early projection-aware data contract and use it in initial family placement.
2. Follow with slices D-E so sibling/cousin behavior and upper-family reservation are re-tuned against the new slot model.
3. Use slice F for the current dense local screenshot class once the earlier slot contract is in place.
4. Only after that perform slices G-I to retire redundant late repair logic and converge placement/render behavior.
5. Finish with slice J as a policy/cleanup pass.

Concrete handover-ready definition for Slice A (recommended first architecture slice):

- Purpose:
	- introduce the first early `projection-aware` data contract without yet rewriting the full R3B placement behavior
	- establish a single early truth for `whether` a projection is needed, `why` it is needed, and `what visible slot intent` it should carry into later placement/render stages

- Scope of Slice A:
	- add explicit early projection requirement / visible slot plan types under `app/src/preview3/r3b/types.ts`
	- add a dedicated early builder module (recommended new file: `app/src/preview3/r3b/projectionPlan.ts`)
	- build these artifacts before or alongside the R3B placement plan instead of letting late render/projection code remain the first real owner of projection semantics
	- thread the resulting artifact into R3B placement artifacts in a read-only / preparatory role first

- Recommended core data concepts for Slice A:
	- `projection requirement`:
		- one entry per relationship / family context that may need a visible projected partner slot
		- should minimally carry: relation or family key, owner, companion, preferred side, policy reason, slot class, suppression state/reason, and whether the slot must be respected in placement
	- `visible partner slot plan`:
		- a placement-oriented semantic plan for the visible projection slot before final pixel geometry is chosen
		- should minimally carry: anchor family key, owner, companion, preferred side, slot class, reserve-in-placement flag

- Architectural intent of Slice A:
	- keep projection as a valid core concept
	- stop treating final projection placement heuristics as the first place where projection semantics become concrete
	- prepare for later slices where family axis, child-band geometry, sibling/cousin spacing, and connector preparation consume the same early slot contract

- What Slice A should explicitly NOT do yet:
	- do not fully rewrite child placement
	- do not remove current projection fallbacks yet
	- do not attempt the full connector-model simplification yet
	- do not force a big visual rewrite in the same slice

- Success criteria for Slice A:
	- for every current R3B projection class, the system can answer early and explicitly:
		- is a projection required?
		- who is the owner / anchored partner?
		- on which side is the intended visible slot?
		- which policy caused the projection or suppression?
		- is the slot later required to participate in placement geometry?
	- these answers exist as explicit R3B artifacts rather than only as late implicit logic in `projections.ts`

- Files most likely involved first:
	- `app/src/preview3/r3b/types.ts`
	- `app/src/preview3/r3b/projectionPlan.ts` (recommended new module)
	- `app/src/preview3/r3b/placement.ts`
	- later slices will likely touch `app/src/preview3/r3b/projections.ts` and `app/src/preview3/r3b/renderModel.ts` more heavily, but Slice A should keep them mostly behavior-stable where possible

## Preview3 Cleanup Checkpoint (Deferred, 09. August 2026)

This is intentionally parked for later continuation.

Current stable checkpoint before pause:

- Build is green (`npm run build` in `app/`).
- R2 invariants remain stable in Playwright checks:
	- Arwen/Aragorn each render as `base=1` and `projection=1`.
	- Silmarien/Elatan projection suppression is active (`projection=0`).
	- Elrond/Celebrian vertical alignment remains stable (`dy=0`).
- R2 pair-placement cleanup was progressed without changing the validated behavior:
	- explicit local pair-placement API is in place,
	- compatibility wrapper still exists,
	- pipeline uses the explicit post-layout flow.

Deferred follow-up (do later):

1. Continue semantic cleanup to reduce legacy overlap around pair-placement APIs.
2. Keep deterministic R2 flow explicit (`family cohesion -> local pair placement -> final geometry`).
3. Maintain the same guard loop per slice (`build -> Playwright invariants -> continue`).

## Step 5 Closure (05. August 2026)

The requested "step 5" continuation (final QA loop + state update + commit-readiness check) is now completed.

What was validated in this closure pass:

- Preview2 shell and core controls are present and interactive (Reset View, Export PNG, dataset select).
- Tree interaction path is still stable after the recent touch adjustments:
	- wheel/trackpad-style zoom over the tree changes SVG `viewBox`,
	- page zoom is prevented in-tree (`defaultPrevented: true`).
- Build remains green (`npm run build` in `app/`) with no new diagnostics in touched files.

Current assessment:

- Items previously listed as steps 1-4 are currently functioning well based on the latest checks and user confirmation.
- Workspace is in a practical commit-ready state for the recent Preview2 stabilization changes.

## Feedback Batches Completed (05. August 2026)

Following user-prioritized feedback order was implemented in this session:

- Batch 1 (Panel Usability & Spacing):
	- safer undocked-panel drag initiation,
	- improved panel header/title/action layout,
	- larger and clearer resize affordances.
- Batch 2 (Selection/LCA UX):
	- explicit selection count (`x/2 selected`),
	- quick actions (`Swap A/B`, per-slot `Focus`, clear flow),
	- explicit LCA state label (`Idle`, `Connected`, `No path`) plus `Center ancestor` action.
- Batch 3 (Theme/Contrast Tuning):
	- active controls inside tree panels now follow tree accent semantics,
	- improved hover/readability in search and LCA state chips.
- Batch 4 (Export/Toolbar Polish):
	- PNG menu outside-click behavior hardened via dedicated menu ref,
	- export actions now lock while PNG export is running to avoid conflicting interactions.

Validation for these batches:

- `npm run build` in `app/` passes after all four feedback batches.
- No new diagnostics reported in touched Preview2 files.

## Current Preview2 Status (04. August 2026)

The Preview2 rebuild slice has now moved from planning into implemented state for the core UX phases agreed in-session.

What was implemented in this slice:

- Persisted Preview2 preferences are now normalized defensively on read (`legendarium.preview2.preferences.v1`) to avoid partial/legacy state breakage.
- Theme semantics are now explicitly separated as agreed:
	- `light` and `dark` map to neutral default palettes.
	- `thematic` maps to the selected preset palette.
	- `custom` stays explicit via preset selection plus editor.
- `Reset settings` is now implemented with confirmation and resets only Preview2-local UI state.
- Show-in-tree interaction was adjusted to current intent: matched nodes are visibly emphasized, and optional auto-fit behavior is tied to the corresponding toggle.
- A/B selection UX was extended with explicit add/remove toggles in Search, Selection, and Inspector surfaces.
- LCA empty-state clarity was improved with a specific no-connection message when A and B are both set but not biologically connected.
- PNG export interaction was changed from select-dropdown flow to click-menu flow (`Current view` / `All filtered`).
- Header title and multiple spacing/padding/panel interaction details were refined according to the recent feedback batch.
- Primary panel resizing behavior is now extended:
	- docked: width resize
	- undocked: width + height resize

Critical runtime fix completed after implementation:

- A React hook-order runtime failure (`Rendered more hooks than during the previous render`) was fixed by moving the newly introduced auto-fit effect out of a conditional render path and ensuring stable top-level hook registration order.

Validation in this slice:

- `npm run build` in `app/` passes after Preview2 implementation and after the hook-order runtime fix.
- TypeScript diagnostics for touched Preview2 files report no current errors.

## QA Session Results (05. August 2026)

A structured manual+interactive QA session was executed against a fresh dev instance at `http://127.0.0.1:5181/preview2` (to avoid stale processes on previously occupied ports).

Validated and passing:

- Header/title + current Preview2 shell renders as expected (new state, no hook-order crash during tested flows).
- PNG export uses click-menu interaction and shows both options: `Current view` and `All filtered`.
- A/B selection toggles work in search results:
	- `Add A/B` transitions correctly to `Remove A/B`.
	- Selection summary and Inspector actions remain consistent with current state.
- LCA no-connection state message appears correctly when two biologically disconnected persons are selected.
- Reset settings flow works with confirmation prompt and returns UI state to defaults.
- Theme gating behaves correctly:
	- Editor is disabled outside `custom` preset.
	- Editor becomes enabled when preset is switched to `custom`.
- Dataset switching works across `demo`, `testing`, and `prod` without runtime failure; `prod` empty-state surfaces behave correctly.
- Panel resize behavior verified interactively:
	- docked panel width can be resized,
	- undocked panel width and height can both be resized.

Observed residual issue (known, non-blocking for this slice):

- Browser console still logs passive wheel-listener warnings during zoom interaction (`Unable to preventDefault inside passive event listener invocation`). This aligns with the existing pending todo and is not introduced by the recent Preview2 slice.

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

## Current Preview UI Status (12. Juli 2026)

The Preview page is currently in a **POC/transitional state** after multiple iterative layout experiments.

What is currently true:

- Primary panel concept is implemented (Filter, Search, Selection & LCA, Inspector) with minimize and undock controls.
- Drag behavior for undocked primary panels exists and is working at code level.
- A separate tool-canvas concept has been introduced for tree/page controls.
- Legend behavior is improved and generally in the expected compact bottom-right style.
- Theme toggles (page/tree) are present and custom-theme popovers are reworked toward button-anchored behavior.

Known UX/layout issues still open:

- Bottom primary panels (`Search`, `Selection & LCA`) still show edge-placement problems in some view states.
- Corner rounding is not yet fully consistent in all panel corners and positions.
- Visual spacing/alignment between control strip, top-right inspector region, and tree area still needs final harmonization.

Decision now locked:

- Preview UI should be treated as **rebuild candidate** (clean reimplementation), using the learned behavior and visual intent from the current POC rather than continuing ad-hoc incremental patching.

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

**Preview2 Stabilization & QA (Now Highest Priority):**
1. Browser validation pass for the completed Preview2 phases (theme semantics, reset flow, selection toggles, LCA states, PNG click-menu, panel resize behavior).
2. Targeted regression checks on dataset switching (`demo/testing/prod`) with persisted state enabled.
3. Verify no reintroduction of hook-order or render-loop issues under rapid interactions (search typing, filter toggles, repeated page/theme mode switches).
4. Add/expand focused tests where practical for state normalization and selection/LCA behavior.
5. Final UI polish pass only after functional QA sign-off.

**Preview UI Rebuild (Highest Priority):**
1. Rebuild Preview page layout cleanly from scratch using current UX intent as the source of truth.
2. Preserve the existing domain behavior (selection/LCA/filter/search/inspector), but re-implement layout and interaction shell coherently.
3. Normalize primary panel geometry and corner logic across all four corners.
4. Ensure stable edge alignment of bottom and right panels within the tree canvas area.
5. Keep legend compact and readable with robust placement relative to analyzer panel.
6. Keep theme behavior clear: tree theme governs tree + primary panels; page theme governs surrounding non-tree surface.
7. Finalize custom-theme popover behavior anchored to the corresponding theme controls.

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