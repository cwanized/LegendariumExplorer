# LegendariumExplorer PowerShell Module

This module provides deterministic dataset tooling for the Legendarium Explorer repository. It can import datasets, run validation, generate scenario-manifest scaffolds, and perform basic authoring operations against the testing, demo, or prod dataset roots.

## Import

From the repository root:

```powershell
Import-Module .\PSModule\LegendariumExplorer.psd1 -Force
```

Most commands accept `-RootPath` and `-DatasetName`. `-DatasetName` supports `testing`, `demo`, and `prod`.

## Exported Commands

### New-LegendariumUuid

Returns a new UUID string for manual dataset work.

```powershell
New-LegendariumUuid
```

### Import-LegendariumDataset

Loads one dataset root into memory. **Important:** This function loads per-item JSON files based on SlimIndex references.

```powershell
Import-LegendariumDataset -RootPath . -DatasetName demo
Import-LegendariumDataset -RootPath . -DatasetName prod -AllowMissing
```

Dataset Structure:

Each dataset is organized as follows:

```
{dataset-name}/
├── persons/
│   ├── index.json (SlimIndex with filenames)
│   ├── {uuid}_{name}.json (individual person files)
│   └── ...
├── relations/
│   ├── index.json (SlimIndex with filenames)
│   ├── {uuid}.json (individual relation files)
│   └── ...
├── events/
│   ├── index.json (SlimIndex with filenames)
│   ├── {uuid}_{type}.json (individual event files)
│   └── ...
└── scenario-manifest.json
```

The `index.json` files contain only **filenames**, not embedded objects:

```json
{
  "items": [
    "550e8400-e29b-41d4-a716-446655440001_arathorn-ii.json",
    "550e8400-e29b-41d4-a716-446655440002_gilraen.json"
  ]
}
```

`Import-LegendariumDataset` reads these index files and loads each individual item file.

### Get-LegendariumPerson

Looks up people by partial name, exact name, or id.

```powershell
Get-LegendariumPerson -RootPath . -DatasetName demo -Name Elrond
Get-LegendariumPerson -RootPath . -DatasetName demo -Name Elrond -Exact
Get-LegendariumPerson -RootPath . -DatasetName demo -Id 550e8400-e29b-41d4-a716-446655440006
```

### Add-LegendariumPerson

Creates one person record and persists it back to the target dataset using per-item files.

```powershell
Add-LegendariumPerson `
  -RootPath . `
  -DatasetName prod `
  -Name "Faramir" `
  -Houses "Stewards of Gondor" `
  -Description "Captain of Gondor" `
  -SourceLinks @(@{ label = "Tolkien Gateway"; url = "https://tolkiengateway.net/wiki/Faramir" }) `
  -PortraitUrl "https://example.org/faramir.png" `
  -PortraitSourceLabel "Repository-curated portrait" `
  -PortraitSourceUrl "https://example.org/faramir-source" `
  -BirthEra "Third Age" `
  -BirthYear 2983
```

Current scope:

- supports houses, description, birth, death, sourceLinks, and optional portrait metadata
- expects each sourceLinks entry to provide both `label` and `url`

### Add-LegendariumMarriage

Creates one `marriage` relation plus one matching marriage event.

```powershell
Add-LegendariumMarriage `
  -RootPath . `
  -DatasetName prod `
  -FirstPersonId <uuid-a> `
  -SecondPersonId <uuid-b> `
  -Era "Third Age" `
  -Year 3019
```

### Add-LegendariumChild

Creates one child and one or two `biological_parent` relations.

```powershell
Add-LegendariumChild `
  -RootPath . `
  -DatasetName prod `
  -Name "Eldarion" `
  -ParentIds <uuid-aragorn>, <uuid-arwen> `
  -SourceLinks @(@{ label = "Tolkien Gateway"; url = "https://tolkiengateway.net/wiki/Eldarion" }) `
  -BirthEra "Fourth Age" `
  -BirthYear 1
```

Current caveat:

- birth timing is still mirrored into both the child record and the generated biological_parent relation attributes

### Invoke-TestingValidation

Runs deterministic validation and optional contract evaluation against `datasets/testing` by default.

```powershell
Invoke-TestingValidation -RootPath .
```

## Data Persistence and Per-Item Files

When using authoring commands (`Add-LegendariumPerson`, `Add-LegendariumMarriage`, `Add-LegendariumChild`), the PSModule automatically:

1. Updates the in-memory dataset
2. Calls `Save-LegendariumDataset` which:
   - Writes **each person** to an individual file: `persons/{uuid}_{name}.json`
   - Writes **each relation** to an individual file: `relations/{uuid}.json`
   - Writes **each event** to an individual file: `events/{uuid}_{type}.json`
   - Writes **SlimIndex files** containing only filenames: `index.json` with `{ items: ["file1.json", "file2.json", ...] }`
   - Writes the scenario manifest: `scenario-manifest.json`

**Important:** The index files must contain **only filenames**, not embedded objects. The frontend app uses these filenames to fetch individual item files.

### Invoke-DemoValidation

Legacy compatibility wrapper retained for older workflows.

Important:

- this wrapper exists for compatibility
- the current architectural truth is that scenario-driven validation lives under `datasets/testing`

### Export-TestingDataset

Writes the embedded seeded fixture set into `datasets/testing`.

```powershell
Export-TestingDataset -RootPath . -Force
```

### Export-DemoDataset

Legacy compatibility wrapper retained for older workflows.

### New-LegendariumScenarioManifestSkeleton

Builds a deterministic scenario-manifest starter from the current dataset contents.

```powershell
New-LegendariumScenarioManifestSkeleton -RootPath . -DatasetName testing
New-LegendariumScenarioManifestSkeleton -RootPath . -DatasetName testing -Contract
```

### Test-LegendariumScenarioManifest

Checks whether scenario-manifest references still point at existing people and relations.

```powershell
Test-LegendariumScenarioManifest -RootPath . -DatasetName testing
```

## Validation Model

The module follows the same deterministic rules as the frontend:

- missing references are ignored with warnings
- self-parent edges are ignored with warnings
- more than two biological parents for one child causes all of those biological_parent edges to be ignored
- cycles are broken by removing the highest lexicographic relation id until the graph is acyclic

## Typical Workflows

### Inspect an existing dataset

```powershell
$dataset = Import-LegendariumDataset -RootPath . -DatasetName demo
$dataset.persons | Select-Object id, name
```

### Add a family slice in prod

```powershell
$first = Add-LegendariumPerson -RootPath . -DatasetName prod -Name "Parent One"
$second = Add-LegendariumPerson -RootPath . -DatasetName prod -Name "Parent Two"
Add-LegendariumMarriage -RootPath . -DatasetName prod -FirstPersonId $first.id -SecondPersonId $second.id
Add-LegendariumChild -RootPath . -DatasetName prod -Name "Child" -ParentIds $first.id, $second.id
```

### Rebuild and verify testing fixtures

```powershell
Export-TestingDataset -RootPath . -Force
Invoke-TestingValidation -RootPath .
Test-LegendariumScenarioManifest -RootPath . -DatasetName testing
```

## Known Limitations

- The embedded seeded dataset helper still reflects an older fixture snapshot and should be kept in sync when dataset structure changes materially.
- `Invoke-DemoValidation` and `Export-DemoDataset` are compatibility wrappers and should not drive new testing architecture.