# Prompt for Agent: Preview UI Rebuild (from Scratch, Product-Grade)

## Objective

Rebuild the **Preview UI** of Legendarium Explorer from scratch as a clean, production-ready interface.

Treat the current implementation as a **behavior reference only** (POC), not as an architectural baseline.

The result must prioritize clarity, consistency, stability, and maintainability over patch compatibility.

---

## Product Context

The Preview page is the core exploration surface for a rendered genealogy graph.

Users need to:

- inspect the graph quickly,
- filter and find people efficiently,
- run two-person selection + LCA analysis,
- understand graph semantics via legend,
- switch view/theme modes without layout side effects.

The experience must feel deliberate and calm, not improvised.

---

## UX Contract (must be satisfied)

### 1) Workspace hierarchy

The page must clearly communicate these layers:

1. **Tree canvas** (primary workspace)
2. **Primary interaction panels** (Filter, Search, Selection & LCA, Inspector)
3. **Tool controls** (view + theme controls)
4. **Legend** (compact interpretation aid)

No layer may feel detached, floating randomly, or visually accidental.

### 2) Primary panel positioning

Primary panels must form a reliable four-corner model around the tree workspace:

- top-left: Filter
- bottom-left: Search
- bottom-right: Selection & LCA
- top-right: Inspector

Expected quality:

- no overlap in normal docked states,
- no clipping outside the intended workspace,
- no drift across resize/theme/mode changes.

### 2a) Minimum panel content (set from POC)

The rebuild must preserve these minimum content blocks per primary panel:

- **Filter (top-left)**
	- grouped categorical filters (at least: house, species, gender, era),
	- quick clear/reset action,
	- immediate effect on visible graph context.

- **Search (bottom-left)**
	- search input,
	- result list with compact context (name + short meta),
	- selecting an entry focuses the corresponding person in the graph.

- **Selection & LCA (bottom-right)**
	- current selection counter/state,
	- guidance for first/second selection,
	- LCA result output when two persons are selected,
	- analysis-related control (e.g., fade-unrelated toggle).

- **Inspector (top-right)**
	- stable empty state when no person is selected,
	- selected person summary,
	- key person metadata useful for exploration decisions.

The intent is functional parity with the current POC panel purpose, but with cleaner structure and better UX quality.

### 2b) Primary vs Secondary responsibility boundary (set from POC)

Use this strict boundary:

- **Primary panels** contain all core exploration interactions that users need continuously while reading the tree:
	- filter,
	- search/focus,
	- selection + LCA analysis,
	- person inspection.

- **Secondary panels** are supportive surfaces only (auxiliary context, diagnostics, optional helper information).

Rules:

1. Any interaction required for normal graph exploration belongs to **Primary**, not Secondary.
2. Secondary panels may collapse/hide first when space is constrained.
3. Hiding secondary panels must never block core preview workflow.
4. Fullscreen/wide modes must preserve complete primary workflow without depending on secondary surfaces.

### 3) Primary panel interaction model

All primary panels must support:

- minimize/restore,
- docked default behavior,
- optional undocked repositioning.

Undocked movement must remain constrained and predictable in the intended interaction area.

### 4) Tool control behavior

Tool controls must remain continuously available and must not collide with primary panels.

Control behavior must remain robust under narrow widths and resize transitions.

### 5) Theme governance (explicit)

- **Tree theme** governs: tree canvas + primary panel surfaces.
- **Page theme** governs: non-tree page surfaces and surrounding chrome.

This split must be visible and consistent in all states.

### 6) Custom theme editors (flyovers)

Custom-theme flyovers must be:

- clearly tied to the corresponding theme context,
- clearly openable,
- clearly dismissible,
- free from ghost or ambiguous state.

Flyovers must not create uncertainty about whether page-theme or tree-theme is being edited.

### 7) Legend behavior

Legend must be compact, readable, and responsive.

Requirements:

- does not dominate the canvas,
- stays usable alongside Selection & LCA,
- remains semantically structured and scannable,
- placement remains intentional relative to analyzer area.

### 8) Visual geometry language

The shape language for primary surfaces must be coherent:

- edges aligned to workspace boundaries: crisp/intentional,
- corners facing into free workspace: subtly rounded.

No inconsistent corner impression between panels.

### 9) Responsive behavior

Desktop, tablet, and mobile must each feel purpose-built.

Smaller breakpoints must avoid overlap and hidden critical controls, using clear stacking/fallback behavior.

---

## Functional Scope to Preserve

Do not remove existing Preview capabilities:

- pan / zoom / reset,
- filtering,
- search + focus,
- person inspection,
- 2-person selection + LCA,
- legend visibility,
- page/tree theme switching.

This is a **UX shell rebuild**, not a feature cut.

---

## Non-Goals

- No requirement to preserve existing Preview layout code structure.
- No pixel-perfect copy of current POC.
- No new business features beyond current Preview scope.

---

## Acceptance Criteria (product level)

The rebuilt Preview is accepted when all are true:

1. Panel and control placement remains stable across common user flows.
2. Bottom and right panels do not protrude outside intended workspace.
3. Theme split (tree vs page) is visually and behaviorally unambiguous.
4. Legend remains compact and non-disruptive while still informative.
5. Flyovers are reliable to open/close and clearly contextual.
6. The interface reads as one coherent system, not a patched composition.

---

## Validation Matrix (minimum)

Validate at three viewport classes (desktop, tablet, mobile) against at least these states:

1. baseline docked state,
2. tree custom-theme editor active,
3. page custom-theme editor active,
4. undocked panel movement state,
5. minimized-panels + legend-visible state.

Document any trade-offs explicitly.

---

## Delivery Requirements

Provide:

1. A clean Preview rebuild implementation.
2. A concise rationale of major UX/layout decisions.
3. A short validation report against the acceptance criteria and validation matrix.

Optimize for long-term maintainability and product clarity.
