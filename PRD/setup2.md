# SETUP.md (Aligned to PRD-reviewed3)

## Legendarium Explorer — Repository Setup (Architecture Aligned)

This document is now fully aligned with:

> PRD-reviewed3.md (Architecture Locked)

---

# 1. High-Level Structure

```text
.
├── app/
├── PSModule/
├── data/
├── demo/
├── docs/
├── scripts/
└── README.md
```

---

# 2. Core Invariant Alignment

This repository strictly enforces:

- UUID-based identity model
- canonical temporal model `{ era, year } | null`
- deterministic biological graph validation
- fault-tolerant rendering
- demo dataset as behavioral contract

---

# 3. UUID Consistency Rule (MANDATORY)

All entities MUST use UUIDs as `id`.

## Rules

- `id` in JSON = UUID only
- filenames MAY be human-readable
- filenames MUST NOT be treated as identity

---

## Valid Example

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Aragorn"
}
```

---

## Invalid Example

```json
{
  "id": "p1"
}
```

---

## File Naming Example (Allowed)

```text
persons/aragorn.json
```

BUT:

```text
id != filename
```

---

# 4. `/app`

Unchanged

Responsible for:

- graph rendering
- ELK.js layout
- biological projection
- overlay relations
- validation visualization

---

# 5. `/PSModule`

Unchanged structurally, but MUST comply with PRD-reviewed3:

- UUID generation required
- canonical time model enforcement
- deterministic validation logic
- scenario-aware demo validation support

---

# 6. `/data` — Production Dataset

```text
data/
├── persons/
├── relations/
└── events/
```

Rules:

- production only
- no synthetic test structures
- must remain clean dataset

---

# 7. `/demo` — Canonical Test Contract Dataset

The `/demo` dataset is a **formal behavioral contract**, not optional data.

---

## 7.1 Structure

```text
demo/
├── persons/
├── relations/
├── events/
└── scenario-manifest.json
```

---

# 7.2 Scenario Manifest (ENHANCED CONTRACT MODEL)

The scenario manifest is now a **test specification**, not just metadata.

---

## Schema

```json
{
  "scenarios": [
    {
      "name": "cycle_detection",
      "description": "Biological cycle resolution test",

      "input": {
        "persons": ["uuid1", "uuid2"],
        "relations": ["uuid10", "uuid11", "uuid12"]
      },

      "expected": {
        "ignoredRelations": ["uuid12"],
        "warnings": [
          "cycle_detected"
        ],
        "disconnectedComponents": 0,
        "status": "warning"
      }
    }
  ]
}
```

---

## Expected Fields

Each scenario MAY define:

- `expectedWarnings`
- `expectedIgnoredRelations`
- `expectedDisconnectedComponents`
- `expectedStatus`

---

# 7.3 Fault Case Classification

Fault cases are explicitly separated:

## 1. Placeholder Persons (VALID)

Used for incomplete but valid entities:

```json
{
  "id": "uuid",
  "name": "Unknown"
}
```

---

## 2. Dangling References (INVALID CASE)

Used for validation testing:

```text
Relation references non-existent UUID
```

Must trigger warning and relation ignore.

---

# 8. Biological Graph Rules (PRD ALIGNED)

---

## 8.1 Over-Parent Rule (FINAL)

If a child has:

```text
> 2 biological parents
```

### Behavior (MANDATORY)

- ALL biological_parent relations for that child are ignored
- warning is generated
- no partial selection

---

## 8.2 Cycle Resolution Rule (DETERMINISTIC)

Cycle detection MUST:

1. identify all cycle-involved relations
2. select relation with highest UUID (lexicographically)
3. remove that relation
4. repeat until acyclic

---

## 8.3 Self-Parent Rule

```text
A -> A
```

Behavior:

- ignore relation
- generate warning

---

# 9. `/demo` Dataset Requirements

Minimum dataset requirements:

- ≥ 50 persons
- ≥ 200 relations
- ≥ 10 events

---

Must include:

- valid lineage tree
- cyclic biological graph
- >2 parent case
- missing data case
- dense social overlay
- multi-era timeline distribution
- disconnected subgraphs

---

# 10. CI CONTRACT (FORMALIZED)

CI MUST validate `/demo` using deterministic assertions.

---

## 10.1 Required Outputs per Scenario

CI MUST produce:

### 1. Normalized Validation Report

- warnings
- ignored relations
- invalid structures

---

### 2. Normalized Ignored Relation List

Deterministic order required:

```text
sorted by UUID
```

---

### 3. Optional Layout Snapshot

Per scenario:

```text
layout_snapshot.json
```

Contains:

- node positions
- edges rendered
- collapsed/ignored edges

---

# 10.2 CI Assertions

CI MUST verify:

- identical input → identical validation output
- identical input → identical ignored relation set
- scenario expected output matches actual output

---

# 11. PSModule CI Alignment

PSModule MUST support:

```powershell
Invoke-DemoValidation
```

and output:

- structured JSON report
- scenario-by-scenario evaluation
- deterministic ordering

---

# 12. Temporal Model (NO CHANGES, REAFFIRMED)

Canonical model:

```json
{
  "era": "Third Age",
  "year": 2931
}
```

or:

```json
null
```

Rules:

- applies to persons, relations, events
- no alternative formats allowed

---

# 13. Final Architecture Alignment Statement

This repository strictly conforms to:

- UUID-based identity model
- graph-based domain representation
- biological tree projection layout
- deterministic validation rules
- fault-tolerant rendering strategy
- scenario-driven demo contract testing

---

# 14. Non-Negotiable Invariants

- no ID ambiguity (UUID only)
- no partial biological parent resolution
- no non-deterministic cycle handling
- no alternative time formats
- no filename-based identity resolution

---

# STATUS

```text
ARCHITECTURE ALIGNED
```