# PRD-REVIEW2.md

Version: 1.1 (Architecture Locked)

This document contains additional architectural decisions made after the first PRD review.

---

# 1. Product Positioning

## Product Name

Legendarium Explorer

---

## Technical Scope

The application shall remain domain-agnostic at the architectural level.

The system is designed as a:

> Genealogical & Social Graph Explorer

The Tolkien Legendarium is the primary showcase dataset and reference domain.

The data model must remain generic enough to support:

- Tolkien
- historical genealogy
- fictional worlds
- community-created datasets
- GEDCOM imports

without requiring architectural changes.

---

# 2. Biological Graph Validation

The biological graph is used for generation calculation and layout.

Invalid biological structures must not break rendering.

---

## Rule

Rendering SHALL continue even when invalid biological relations exist.

Invalid relations SHALL be excluded from layout generation.

Warnings SHALL be generated.

---

## Self Parent

Invalid:

```text
A -> A
```

Behavior:

```text
Ignore relation
Generate warning
Continue rendering
```

---

## Cycles

Invalid:

```text
A -> B
B -> C
C -> A
```

Behavior:

```text
Cycle-producing relation ignored
Warning generated
Continue rendering
```

---

## More Than Two Biological Parents

Invalid:

```text
P1 -> Child
P2 -> Child
P3 -> Child
```

Behavior:

```text
Maximum two biological parents retained
Additional relations ignored
Warning generated
```

---

## Missing References

Invalid:

```text
Relation points to non-existing person
```

Behavior:

```text
Relation ignored
Warning generated
Continue rendering
```

---

# 3. Relation Endpoint Rules

MVP Scope:

```text
Person -> Person
```

only.

---

## Allowed

```text
Person -> Person
```

Examples:

- biological_parent
- marriage
- mentor
- adoption
- step_parent

---

## Not Supported

```text
House -> Person
House -> House
Event -> Person
Place -> Person
```

These may be introduced in future versions.

---

# 4. Temporal Model

The MVP intentionally uses a simple temporal model.

---

## Allowed Values

Temporal fields SHALL contain:

```text
Integer year
```

or

```text
null
```

Examples:

```json
2931
3019
-500
null
```

---

## Not Supported

```text
ca. 2931
2930-2935
unknown
around 3000
```

These concepts may be introduced in future versions.

---

# 5. Tolkien Era Support

The application MUST support multiple calendar eras.

A year alone is insufficient.

Temporal values SHALL support an era identifier.

---

## Supported Eras (MVP)

```text
Years of the Lamps
Years of the Trees
First Age
Second Age
Third Age
Fourth Age
```

---

## Example

Person:

```json
{
  "id": "uuid",
  "name": "Aragorn",

  "birth": {
    "era": "Third Age",
    "year": 2931
  },

  "death": {
    "era": "Fourth Age",
    "year": 120
  }
}
```

Relation:

```json
{
  "id": "uuid",
  "type": "marriage",

  "from": "uuid",
  "to": "uuid",

  "attributes": {
    "date": {
      "era": "Third Age",
      "year": 3019
    }
  }
}
```

---

## Generic Rule

The architecture shall support arbitrary eras.

Example:

```json
{
  "era": "Custom Era",
  "year": 123
}
```

The Tolkien eras are defaults, not hardcoded limitations.

---

# 6. Timeline View

Timeline remains a future feature.

---

## Important Rule

Timeline is a derived projection.

Timeline data SHALL be generated from:

- Person.birth
- Person.death
- Relation dates
- Event dates

Timeline data SHALL NOT be the primary source of truth.

---

# 7. Performance Targets

The following are target metrics, not hard guarantees.

---

## Dataset Size

Target:

```text
3000 persons
10000 relations
```

---

## Initial Render

Target:

```text
< 5 seconds
```

on a typical desktop browser.

---

## Search

Target:

```text
< 200 ms
```

for name search.

---

## Multi Selection Analysis

Target:

```text
< 500 ms
```

for lineage highlighting.

---

## Navigation

Target:

```text
60 FPS preferred
30 FPS minimum acceptable
```

during:

- zoom
- pan
- selection

---

# 8. Lowest Common Ancestor

The MVP multi-selection feature uses:

```text
Lowest Common Ancestor
```

analysis only.

---

## Input

```text
Shift + Click Person A
Shift + Click Person B
```

---

## Output

Highlight:

- common ancestor
- connecting lineage

Fade:

- unrelated nodes

---

## Not Included In MVP

```text
Shortest path across all relation types
```

This may be added later.

---

# 9. Final Architecture Position

Data Model:

```text
Graph
```

Layout Model:

```text
Biological Tree Projection
```

Timeline:

```text
Derived Projection
```

Social Relations:

```text
Overlay Layer
```

Rendering:

```text
Fault Tolerant
```

Invalid biological relations shall never prevent the graph from being explored.

Warnings are preferred over hard failures.