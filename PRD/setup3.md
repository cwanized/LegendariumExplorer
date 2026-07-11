# SETUP.md (Implementation Start Aligned)

## Legendarium Explorer — Repository Setup and Dataset Roles

This document supersedes setup2.md for implementation start readiness.

It is aligned with:

- PRD-reviewed3.md as the architecture source of truth
- PROMPT/prompt.md as the implementation behavior contract

---

# 1. Repository Structure

```text
.
├── app/
├── datasets/
│   ├── testing/
│   ├── demo/
│   └── prod/
├── PSModule/
├── docs/
├── scripts/
└── README.md
```

---

# 2. Repository Invariants

All implementation work MUST respect these invariants:

- UUID-only entity identity
- canonical temporal model as `{ era, year } | null`
- deterministic biological graph validation
- fault-tolerant rendering
- scenario-driven testing verification
- explicitly authored external source links

---

# 3. Identity Rules

## 3.1 Entity IDs

All entities MUST use UUIDs in JSON.

Example:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000"
}
```

Short aliases such as `p1`, `r1`, or `e1` MUST NOT be used as IDs.

---

## 3.2 Filenames

Filenames are human-readable but follow a strict naming convention to support per-item JSON file storage.

**Persons:** `{uuid}_{kebab-case-name}.json`

Example:

```text
datasets/demo/persons/550e8400-e29b-41d4-a716-446655440003_aragorn-ii.json
```

**Relations:** `{uuid}.json` (UUID only, no type suffix)

Example:

```text
datasets/demo/relations/0fd327c3-9f1b-4190-928e-c19f7cd003b2.json
```

**Events:** `{uuid}_{kebab-case-type}.json`

Example:

```text
datasets/demo/events/550e8400-e29b-41d4-a716-446655442001_marriage.json
```

IMPORTANT: 

- Identity is determined **only by the JSON `id` field**, not by the filename
- Filenames are used only for file organization and SlimIndex references
- The kebab-case name portion in person/event filenames is for readability and MUST NOT be parsed for identity
- Accented characters in names are normalized to ASCII (e.g., Eärendil → erendil, Túor → tuor)

---

# 4. Dataset Separation

## 4.1 Testing Dataset

```text
datasets/testing/
├── persons/
│   ├── index.json
│   ├── {uuid}_{name}.json
│   └── ...
├── relations/
│   ├── index.json
│   ├── {uuid}.json
│   └── ...
├── events/
│   ├── index.json
│   ├── {uuid}_{type}.json
│   └── ...
└── scenario-manifest.json
```

Rules:

- regression fixtures may include intentionally invalid graph cases
- contract scenarios live here
- deterministic validation expectations are defined here

Per-Item File Structure (IMPORTANT):

- **Each person, relation, and event is stored in an individual JSON file**
- Person files: `{uuid}_{kebab-case-name}.json` (e.g., `550e8400-e29b-41d4-a716-446655440001_aragorn-ii.json`)
- Relation files: `{uuid}.json` (e.g., `0fd327c3-9f1b-4190-928e-c19f7cd003b2.json`)
- Event files: `{uuid}_{kebab-case-type}.json` (e.g., `550e8400-e29b-41d4-a716-446655442001_marriage.json`)

Index Format (SlimIndex):

Each `index.json` contains ONLY a list of filenames, not embedded objects:

```json
{
  "items": [
    "550e8400-e29b-41d4-a716-446655440001_arathorn-ii.json",
    "550e8400-e29b-41d4-a716-446655440002_gilraen.json",
    "550e8400-e29b-41d4-a716-446655440003_aragorn-ii.json"
  ]
}
```

The frontend app loads the index, then fetches each item file individually.

---

## 4.2 Demo Dataset

```text
datasets/demo/
├── persons/
│   ├── index.json
│   ├── {uuid}_{name}.json
│   └── ...
├── relations/
│   ├── index.json
│   ├── {uuid}.json
│   └── ...
├── events/
│   ├── index.json
│   ├── {uuid}_{type}.json
│   └── ...
└── scenario-manifest.json
```

Rules:

- valid showcase data only
- no synthetic invalid fault cases
- intended for visual review, onboarding, and presentation
- persons MAY include sourceLinks and optional portrait metadata for source/portrait UI review
- follows the same per-item file structure as testing dataset

---

## 4.3 Production Dataset

```text
datasets/prod/
├── persons/
│   ├── index.json
│   ├── {uuid}_{name}.json
│   └── ...
├── relations/
│   ├── index.json
│   ├── {uuid}.json
│   └── ...
├── events/
│   ├── index.json
│   ├── {uuid}_{type}.json
│   └── ...
└── scenario-manifest.json
```

The prod dataset is the published end-user dataset.

It MAY start empty until a curated publication-ready dataset exists.

Follows the same per-item file structure as testing and demo datasets.

---

# 5. Scenario Manifest Contract

The scenario manifest defines deterministic expectations for testing scenarios.

Canonical shape:

```json
{
  "scenarios": [
    {
      "name": "cycle_detection",
      "description": "Biological cycle resolution test",
      "contract": true,
      "input": {
        "persons": [
          "550e8400-e29b-41d4-a716-446655440001",
          "550e8400-e29b-41d4-a716-446655440002"
        ],
        "relations": [
          "550e8400-e29b-41d4-a716-446655440010",
          "550e8400-e29b-41d4-a716-446655440011",
          "550e8400-e29b-41d4-a716-446655440012"
        ]
      },
      "expected": {
        "ignoredRelations": [
          "550e8400-e29b-41d4-a716-446655440012"
        ],
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

## 5.1 Contract Flag

Each scenario MUST declare:

- `contract: true` for deterministic regression scenarios
- `contract: false` for exploratory or non-blocking scenarios

---

## 5.2 Expected Output Rules

If `contract` is `true`, the scenario MUST include `expected`.

If `contract` is `false`, `expected` MAY be omitted.

The `expected` object MAY contain:

- `ignoredRelations`
- `warnings`
- `disconnectedComponents`
- `status`

Contract scenarios SHOULD define every field that is relevant to the tested behavior.

---

# 6. Fault Case Classification

## 6.1 Placeholder Persons (Valid)

Used for incomplete but valid entities.

Example:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440100",
  "name": "Unknown"
}
```

---

## 6.2 Dangling References (Invalid)

Used for validation tests only.

Example:

```text
Relation references a non-existent UUID
```

Required behavior:

- ignore relation
- emit warning
- continue rendering

---

# 6.3 External Source Metadata

Person records MAY include external source metadata.

Canonical source entry:

```json
{
  "label": "Tolkien Gateway",
  "url": "https://tolkiengateway.net/wiki/Elrond"
}
```

Rules:

- `sourceLinks` is an ordered array
- the first sourceLinks entry is the primary source
- all source URLs MUST be explicitly stored in JSON
- the system MUST NOT derive or synthesize source URLs from names
- portrait URLs MAY be stored separately from sourceLinks
- if `portraitUrl` is present, `portraitSourceLabel` and `portraitSourceUrl` SHOULD be present as well

---

# 7. Biological Validation Rules

## 7.1 Over-Parent Rule

If a child has more than two `biological_parent` relations:

- all `biological_parent` relations targeting that child are ignored for layout
- warning is generated
- no partial selection is allowed

---

## 7.2 Cycle Resolution Rule

Cycle handling MUST be deterministic:

1. identify cycle-involved biological relations
2. remove the relation with the highest UUID using lexicographic comparison
3. repeat until the biological graph is acyclic

---

## 7.3 Self-Parent Rule

If `A -> A` exists as a biological relation:

- ignore relation
- emit warning
- continue rendering

---

# 8. Minimum Demo Coverage

The demo dataset MUST include:

- one clean lineage baseline
- one biological cycle case
- one over-parent case
- one dangling reference case
- one missing birth or death case
- one dense social overlay case
- one mixed-era case
- one disconnected-components case

Minimum size target:

- 50 persons
- 200 relations
- 10 events

---

# 9. CI Contract

CI MUST validate contract scenarios deterministically.

Required outputs:

- normalized warning list sorted by UUID or stable code order
- normalized ignored relation list sorted by UUID
- scenario status result
- optional normalized layout snapshot

CI MUST verify:

- identical input yields identical validation output
- contract scenario expected output matches actual output
- invalid data never causes render-path failure

---

# 10. Implementation Start Gate

Implementation may begin when the following exist:

- repository scaffold directories
- app project bootstrap
- canonical shared types
- deterministic validation core
- demo manifest with at least one contract scenario

---

# Status

```text
IMPLEMENTATION START READY
```
*** Add File: c:\Users\TZHWACH5\_repos\github.com\LegendariumExplorer\PRD\PRD-reviewed4.md
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