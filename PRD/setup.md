# SETUP.md (Extended)

## Legendarium Explorer — Repository Setup + Demo Dataset

This document defines the full repository structure including:
- Web Application (`/app`)
- PowerShell Module (`/PSModule`)
- Core Data (`/data`)
- **Demo Dataset (mandatory for testing & validation)**

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

# 2. `/app`

(unchanged)

Responsible for graph rendering, UI, layout (ELK.js), interactions.

---

# 3. `/PSModule`

(unchanged)

Responsible for:
- data generation
- validation
- imports (future GEDCOM)
- tooling for contributors

---

# 4. `/data` — Production Source of Truth

```text
data/
├── persons/
├── relations/
└── events/
```

Rules:
- production datasets only
- no synthetic test data
- must remain clean and community-maintained

---

# 5. `/demo` — Canonical Test Dataset (IMPORTANT)

The `/demo` folder contains a **fully self-contained dataset** designed to cover all edge cases.

Purpose:
- UI testing
- layout validation
- CI regression tests
- ELK.js stress testing
- developer onboarding

---

## 5.1 Structure

```text
demo/
├── persons/
├── relations/
├── events/
└── scenario-manifest.json
```

---

## 5.2 Design Principles

The demo dataset MUST include:

### Structural Edge Cases
- multiple generations
- disconnected graphs
- dense intermarriages (loop-heavy structures)
- missing parents
- unknown persons

---

### Invalid / Fault Cases
- self-parent relations
- cyclic biological graphs
- >2 biological parents
- dangling references

---

### Temporal Edge Cases
- null dates
- mixed eras
- extreme historical values
- missing birth/death data

---

### Social Complexity
- mentor relationships
- step-parent relationships
- adoption cases
- overlapping social + biological roles

---

### Scale Testing
- at least:
  - 50 persons (minimum)
  - 200 relations (minimum)
  - 10+ events

---

# 5.3 Example Structure

## Persons

```text
demo/persons/p1.json
demo/persons/p2.json
demo/persons/p3.json
```

Example:

```json
{
  "id": "p1",
  "name": "Aragorn",
  "birth": { "era": "Third Age", "year": 2931 },
  "death": { "era": "Fourth Age", "year": 120 },
  "houses": ["Dunedain"]
}
```

---

## Relations

```text
demo/relations/r1.json
demo/relations/r2.json
```

Example:

```json
{
  "id": "r1",
  "type": "biological_parent",
  "from": "p10",
  "to": "p1"
}
```

---

## Events

```text
demo/events/e1.json
demo/events/e2.json
```

Example:

```json
{
  "id": "e1",
  "type": "marriage",
  "date": { "era": "Third Age", "year": 3019 },
  "participants": ["p1", "p2"]
}
```

---

## Scenario Manifest (IMPORTANT)

```text
demo/scenario-manifest.json
```

Defines test scenarios explicitly.

Example:

```json
{
  "scenarios": [
    {
      "name": "simple_lineage",
      "description": "Basic 3-generation tree",
      "persons": ["p1", "p2", "p3"],
      "relations": ["r1", "r2"]
    },
    {
      "name": "cycle_detection",
      "description": "Biological cycle must be resolved deterministically",
      "relations": ["r10", "r11", "r12"]
    },
    {
      "name": "invalid_parents",
      "description": ">2 biological parents test case",
      "relations": ["r20", "r21", "r22"]
    }
  ]
}
```

---

# 5.4 Required Test Scenarios

The demo dataset MUST explicitly include:

---

## A. Clean Tree

- valid biological hierarchy
- no cycles
- deterministic layout baseline

---

## B. Cycle Case

- at least one biological cycle
- must trigger deterministic removal rule

---

## C. Over-Parent Case

- at least one person with >2 biological parents
- must trigger pruning rule

---

## D. Dense Social Graph

- high number of:
  - marriages
  - mentor links
  - cross-family connections

---

## E. Missing Data Case

- persons with:
  - missing birth
  - missing death
  - missing relations

---

## F. Multi-Era Timeline Case

- mixed eras:
  - First Age
  - Second Age
  - Third Age
- null values included

---

## G. Disconnected Components

- at least 2 separate subgraphs
- no connecting relations

---

# 6. Integration with App

The `/app` MUST support:

```text
--mode demo
```

Behavior:

- loads `/demo` dataset
- enables debug overlays
- shows validation warnings
- highlights invalid relations

---

# 7. Integration with PSModule

PSModule MUST be able to:

```powershell
Import-DemoDataset
```

and:

```powershell
Validate-DemoDataset
```

---

# 8. CI Expectations (Future Ready)

CI SHOULD:

- run validation on `/demo`
- ensure all scenarios load without crash
- verify deterministic layout output
- ensure warning generation works

---

# 9. Key Principle

The demo dataset is not optional.

It is a **first-class contract of the system**, equal in importance to production data.

---

# 10. Summary

This repository contains:

- `/app` → rendering system
- `/PSModule` → data tooling
- `/data` → production dataset
- `/demo` → canonical test & edge-case dataset

The `/demo` dataset defines the **behavioral truth of the system under stress conditions** and is required for development, validation, and regression testing.