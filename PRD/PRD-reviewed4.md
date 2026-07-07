# PRD-REVIEWED4.md

Version: 1.3 (Implementation Start Addendum)

This document does not replace the architecture invariants in PRD-reviewed3.md.

It records the final decisions needed to start implementation without reopening architecture scope.

---

# 1. Authoritative Documents

The implementation start baseline is:

- PRD-reviewed3.md for architecture invariants
- setup3.md for repository and demo-contract rules
- PROMPT/prompt.md for implementation behavior

If these documents conflict, resolve them in this order:

1. PRD-reviewed3.md
2. PROMPT/prompt.md
3. setup3.md

---

# 2. Implementation Start Principle

The first implementation goal is NOT feature breadth.

The first implementation goal is:

> deterministic, fault-tolerant loading, validation, and rendering of the demo dataset

This means the initial milestone MUST prove:

- invalid biological data does not crash rendering
- ignored relations are deterministic
- warnings are deterministic
- the biological layout input is reproducible

---

# 3. First Mandatory Implementation Slice

The first implementation slice SHALL include:

1. repository scaffold creation
2. app bootstrap with React and TypeScript
3. canonical type definitions
4. deterministic validation pipeline
5. demo dataset loading
6. first end-to-end render of validated biological graph

The following are explicitly deferred from the first slice:

- timeline UI
- shortest-path analysis
- GEDCOM tooling
- browser editing
- advanced styling and polish

---

# 4. Demo Scenario Contract Decision

The demo manifest SHALL use a nested `expected` object.

Each scenario SHALL declare a `contract` boolean.

Rules:

- `contract: true` means deterministic expected outputs are required
- `contract: false` means the scenario is informative or exploratory and may omit expected outputs

This allows the demo dataset to serve both as:

- regression contract
- broader exploratory dataset

without weakening CI guarantees for contract scenarios.

---

# 5. Implementation Guardrails

All code written for the first slice MUST follow these guardrails:

- do not auto-correct invalid data heuristically
- do not let invalid data abort rendering
- do not allow load-order-dependent outcomes
- do not mix alternate temporal formats
- do not derive identity from filenames

---

# 6. Start Criteria

Implementation should start immediately after these checks are true:

1. setup3.md is accepted as the setup contract
2. the repository scaffold is created
3. one contract demo scenario is defined end to end

---

# Status

```text
IMPLEMENTATION APPROVED
```