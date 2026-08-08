# PRD-REVIEWED5.md

Version: 1.0 (Mode D Clarification Addendum)

This document captures the agreed Mode D rules from the architecture workshop.
It is focused on mode behavior and does not replace all invariants from earlier PRD files.

---

# 1. Scope

This addendum defines the Mode D core behavior for:

- house start anchors
- house vertical offset semantics
- house order
- marriage continuation ownership
- deterministic fallback behavior

---

# 2. House Tier And Start Anchor Rule

House definitions distinguish between:

- `tier: start`
- `tier: later`

Mode D rule:

- `tier: start` can produce a visible start anchor.
- `tier: later` never produces a visible start anchor, even if `anchor.enabled` is `true`.

Rationale:

- later houses (for example Dunedain) may emerge from existing lineages and do not require a global tree start marker.

---

# 3. House Anchor Order

Visible start anchors are ordered by:

- `anchor.order` from `house-definitions.json`

This order is authoritative for left-to-right start-anchor sequencing in Mode D.

---

# 4. House Y-Offset Semantics

Mode D uses generation-based house offset semantics:

- `1 yOffset unit = 1 generation step`

Implications:

- house vertical staging remains understandable and domain-driven.
- examples such as moving Edain starts lower are expressed via `layout.yOffset`.

---

# 5. Marriage Continuation Ownership

Mode D continuation behavior for marriage context:

- default continuation follows the male line.
- per-marriage override is supported and authoritative.

Override field:

- `relation.attributes.layout.continuationOwner`
- allowed values: `from` or `to`

When override is set:

- override wins over default behavior.

---

# 6. Deterministic Fallback

If no override is set and gender is not usable as a clear discriminator:

- continuation owner deterministically falls back to `from`.

This avoids random or load-order-dependent results.

---

# 7. Children Placement Rule

Children belong to the parent pair context and are placed centered on the pair axis.

This preserves:

- visual parent-pair coherence
- stable child group readability

---

# 8. Determinism Requirement

Given identical input and application version, Mode D must produce:

- identical validation result
- identical continuation ownership result
- identical anchor ordering and placement outcome

No heuristic or non-deterministic ownership decisions are allowed.

---

# 9. Documentation Conflict Note

This addendum intentionally introduces a mode-level continuation default that references male-line continuation.

If this conflicts with older generic statements in prior PRD documents, this addendum is authoritative for Mode D behavior until a consolidated PRD merge is completed.

---

# Status

```text
MODE D CLARIFICATION APPROVED
```
