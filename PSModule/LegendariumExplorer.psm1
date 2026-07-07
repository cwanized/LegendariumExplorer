Set-StrictMode -Version Latest

function Get-LegendariumRepoRoot {
    [CmdletBinding()]
    param(
        [string] $RootPath
    )

    if ($RootPath) {
        return (Resolve-Path -LiteralPath $RootPath).Path
    }

    return (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
}

function Get-LegendariumDatasetsRoot {
    [CmdletBinding()]
    param(
        [string] $RootPath
    )

    Join-Path (Get-LegendariumRepoRoot -RootPath $RootPath) 'datasets'
}

function Get-LegendariumTestingPath {
    [CmdletBinding()]
    param(
        [string] $RootPath
    )

    Join-Path (Get-LegendariumDatasetsRoot -RootPath $RootPath) 'testing'
}

function Get-LegendariumDemoPath {
    [CmdletBinding()]
    param(
        [string] $RootPath
    )

    # Legacy wrapper: historical demo commands now point at the testing fixture dataset.
    Get-LegendariumTestingPath -RootPath $RootPath
}

function Get-LegendariumDatasetPath {
    [CmdletBinding()]
    param(
        [string] $RootPath,
        [Parameter(Mandatory)]
        [ValidateSet('testing', 'demo', 'prod')]
        [string] $DatasetName
    )

    Join-Path (Get-LegendariumDatasetsRoot -RootPath $RootPath) $DatasetName
}

function New-LegendariumUuid {
    [CmdletBinding()]
    param()

    [guid]::NewGuid().Guid
}

function ConvertTo-SortedJson {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $InputObject
    )

    $InputObject | ConvertTo-Json -Depth 20
}

function Write-LegendariumJsonFile {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Path,

        [Parameter(Mandatory)]
        [object] $Value
    )

    $directory = Split-Path -Parent $Path
    if (-not (Test-Path -LiteralPath $directory)) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }

    Set-Content -LiteralPath $Path -Value (ConvertTo-SortedJson -InputObject $Value) -Encoding utf8
}

function New-EmptyLegendariumDataset {
    [CmdletBinding()]
    param()

    [ordered]@{
        persons = @()
        relations = @()
        events = @()
        manifest = [ordered]@{
            scenarios = @()
        }
    }
}

function New-TimeValue {
    [CmdletBinding()]
    param(
        [string] $Era,
        $Year,
        [Parameter(Mandatory)]
        [string] $FieldName
    )

    $hasYear = $null -ne $Year

    if ([string]::IsNullOrWhiteSpace($Era) -and -not $hasYear) {
        return $null
    }

    if ([string]::IsNullOrWhiteSpace($Era) -or -not $hasYear) {
        throw "$FieldName requires both -${FieldName}Era and -${FieldName}Year."
    }

    [ordered]@{
        era = $Era
        year = [int] $Year
    }
}

function ConvertTo-OptionalLegendariumString {
    [CmdletBinding()]
    param(
        [AllowNull()]
        [string] $Value
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $null
    }

    return $Value.Trim()
}

function ConvertTo-LegendariumSourceLinks {
    [CmdletBinding()]
    param(
        [object[]] $SourceLinks = @()
    )

    $normalizedLinks = @()

    foreach ($entry in @($SourceLinks)) {
        if ($null -eq $entry) {
            continue
        }

        $label = $null
        $url = $null

        if ($entry -is [System.Collections.IDictionary]) {
            $label = ConvertTo-OptionalLegendariumString -Value ([string] $entry['label'])
            if ($null -eq $label) {
                $label = ConvertTo-OptionalLegendariumString -Value ([string] $entry['Label'])
            }

            $url = ConvertTo-OptionalLegendariumString -Value ([string] $entry['url'])
            if ($null -eq $url) {
                $url = ConvertTo-OptionalLegendariumString -Value ([string] $entry['Url'])
            }
        }
        else {
            $label = ConvertTo-OptionalLegendariumString -Value ([string] $entry.label)
            if ($null -eq $label) {
                $label = ConvertTo-OptionalLegendariumString -Value ([string] $entry.Label)
            }

            $url = ConvertTo-OptionalLegendariumString -Value ([string] $entry.url)
            if ($null -eq $url) {
                $url = ConvertTo-OptionalLegendariumString -Value ([string] $entry.Url)
            }
        }

        if ($null -eq $label -or $null -eq $url) {
            throw 'Each source link must provide both label and url.'
        }

        $normalizedLinks += [ordered]@{
            label = $label
            url = $url
        }
    }

    return @($normalizedLinks)
}

function Assert-PersonExists {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object[]] $Persons,

        [Parameter(Mandatory)]
        [string[]] $PersonIds
    )

    $personIdSet = New-Object System.Collections.Generic.HashSet[string]
    foreach ($person in $Persons) {
        $null = $personIdSet.Add([string] $person.id)
    }

    foreach ($personId in $PersonIds) {
        if (-not $personIdSet.Contains([string] $personId)) {
            throw "Person not found: $personId"
        }
    }
}

function Save-LegendariumDataset {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Dataset,

        [string] $RootPath,

        [string] $DatasetName = 'prod'
    )

    $datasetRoot = Get-LegendariumDatasetPath -RootPath $RootPath -DatasetName $DatasetName

    Write-LegendariumJsonFile -Path (Join-Path $datasetRoot 'persons\index.json') -Value ([ordered]@{ items = @($Dataset.persons | Sort-Object -Property id) })
    Write-LegendariumJsonFile -Path (Join-Path $datasetRoot 'relations\index.json') -Value ([ordered]@{ items = @($Dataset.relations | Sort-Object -Property id) })
    Write-LegendariumJsonFile -Path (Join-Path $datasetRoot 'events\index.json') -Value ([ordered]@{ items = @($Dataset.events | Sort-Object -Property id) })
    Write-LegendariumJsonFile -Path (Join-Path $datasetRoot 'scenario-manifest.json') -Value $Dataset.manifest

    [pscustomobject]@{
        DatasetName = $DatasetName
        DatasetPath = $datasetRoot
        PersonCount = @($Dataset.persons).Count
        RelationCount = @($Dataset.relations).Count
        EventCount = @($Dataset.events).Count
    }
}

function Get-EmbeddedDemoDataset {
    [CmdletBinding()]
    param()

    $persons = @(
        [ordered]@{ id = '550e8400-e29b-41d4-a716-446655440001'; name = 'Arathorn II'; birth = [ordered]@{ era = 'Third Age'; year = 2873 }; death = [ordered]@{ era = 'Third Age'; year = 2931 }; houses = @('Dunedain'); metadata = [ordered]@{ description = 'Chieftain of the Dunedain' } },
        [ordered]@{ id = '550e8400-e29b-41d4-a716-446655440002'; name = 'Gilraen'; birth = [ordered]@{ era = 'Third Age'; year = 2907 }; death = [ordered]@{ era = 'Third Age'; year = 3007 }; houses = @('Dunedain'); metadata = [ordered]@{ description = 'Mother of Aragorn' } },
        [ordered]@{ id = '550e8400-e29b-41d4-a716-446655440003'; name = 'Aragorn II'; birth = [ordered]@{ era = 'Third Age'; year = 2931 }; death = [ordered]@{ era = 'Fourth Age'; year = 120 }; houses = @('Dunedain'); metadata = [ordered]@{ description = 'King Elessar' } },
        [ordered]@{ id = '550e8400-e29b-41d4-a716-446655440004'; name = 'Arwen'; birth = [ordered]@{ era = 'Third Age'; year = 241 }; death = [ordered]@{ era = 'Fourth Age'; year = 121 }; houses = @('Half-elven'); metadata = [ordered]@{ description = 'Daughter of Elrond' } },
        [ordered]@{ id = '550e8400-e29b-41d4-a716-446655440005'; name = 'Eldarion'; birth = [ordered]@{ era = 'Fourth Age'; year = 1 }; death = $null; houses = @('Reunited Kingdom'); metadata = [ordered]@{ description = 'Heir of Aragorn and Arwen' } },
        [ordered]@{ id = '550e8400-e29b-41d4-a716-446655440006'; name = 'Elrond'; birth = [ordered]@{ era = 'First Age'; year = 532 }; death = $null; houses = @('Half-elven'); metadata = [ordered]@{ description = 'Loremaster of Rivendell' } },
        [ordered]@{ id = '550e8400-e29b-41d4-a716-446655440007'; name = 'Parent One'; birth = $null; death = $null; houses = @('Demo'); metadata = [ordered]@{ description = 'Synthetic parent for over-parent validation' } },
        [ordered]@{ id = '550e8400-e29b-41d4-a716-446655440008'; name = 'Parent Two'; birth = $null; death = $null; houses = @('Demo'); metadata = [ordered]@{ description = 'Synthetic parent for over-parent validation' } },
        [ordered]@{ id = '550e8400-e29b-41d4-a716-446655440009'; name = 'Parent Three'; birth = $null; death = $null; houses = @('Demo'); metadata = [ordered]@{ description = 'Synthetic parent for over-parent validation' } },
        [ordered]@{ id = '550e8400-e29b-41d4-a716-446655440010'; name = 'Overchild'; birth = $null; death = $null; houses = @('Demo'); metadata = [ordered]@{ description = 'Receives too many biological parents' } },
        [ordered]@{ id = '550e8400-e29b-41d4-a716-446655440011'; name = 'Cycle Alpha'; birth = $null; death = $null; houses = @('Demo'); metadata = [ordered]@{ description = 'Cycle test node' } },
        [ordered]@{ id = '550e8400-e29b-41d4-a716-446655440012'; name = 'Cycle Beta'; birth = $null; death = $null; houses = @('Demo'); metadata = [ordered]@{ description = 'Cycle test node' } },
        [ordered]@{ id = '550e8400-e29b-41d4-a716-446655440013'; name = 'Cycle Gamma'; birth = $null; death = $null; houses = @('Demo'); metadata = [ordered]@{ description = 'Cycle test node' } },
        [ordered]@{ id = '550e8400-e29b-41d4-a716-446655440014'; name = 'Hallas'; birth = [ordered]@{ era = 'Second Age'; year = 3310 }; death = $null; houses = @('Demo'); metadata = [ordered]@{ description = 'Disconnected placeholder node' } }
    )

    $relations = @(
        [ordered]@{ id = '550e8400-e29b-41d4-a716-446655441001'; type = 'biological_parent'; from = '550e8400-e29b-41d4-a716-446655440001'; to = '550e8400-e29b-41d4-a716-446655440003'; attributes = [ordered]@{ date = $null } },
        [ordered]@{ id = '550e8400-e29b-41d4-a716-446655441002'; type = 'biological_parent'; from = '550e8400-e29b-41d4-a716-446655440002'; to = '550e8400-e29b-41d4-a716-446655440003'; attributes = [ordered]@{ date = $null } },
        [ordered]@{ id = '550e8400-e29b-41d4-a716-446655441003'; type = 'biological_parent'; from = '550e8400-e29b-41d4-a716-446655440006'; to = '550e8400-e29b-41d4-a716-446655440004'; attributes = [ordered]@{ date = $null } },
        [ordered]@{ id = '550e8400-e29b-41d4-a716-446655441004'; type = 'biological_parent'; from = '550e8400-e29b-41d4-a716-446655440003'; to = '550e8400-e29b-41d4-a716-446655440005'; attributes = [ordered]@{ date = [ordered]@{ era = 'Fourth Age'; year = 1 } } },
        [ordered]@{ id = '550e8400-e29b-41d4-a716-446655441005'; type = 'biological_parent'; from = '550e8400-e29b-41d4-a716-446655440004'; to = '550e8400-e29b-41d4-a716-446655440005'; attributes = [ordered]@{ date = [ordered]@{ era = 'Fourth Age'; year = 1 } } },
        [ordered]@{ id = '550e8400-e29b-41d4-a716-446655441006'; type = 'marriage'; from = '550e8400-e29b-41d4-a716-446655440003'; to = '550e8400-e29b-41d4-a716-446655440004'; attributes = [ordered]@{ date = [ordered]@{ era = 'Third Age'; year = 3019 } } },
        [ordered]@{ id = '550e8400-e29b-41d4-a716-446655441007'; type = 'mentor'; from = '550e8400-e29b-41d4-a716-446655440006'; to = '550e8400-e29b-41d4-a716-446655440003'; attributes = [ordered]@{ date = $null } },
        [ordered]@{ id = '550e8400-e29b-41d4-a716-446655441008'; type = 'biological_parent'; from = '550e8400-e29b-41d4-a716-446655440007'; to = '550e8400-e29b-41d4-a716-446655440010'; attributes = [ordered]@{ date = $null } },
        [ordered]@{ id = '550e8400-e29b-41d4-a716-446655441009'; type = 'biological_parent'; from = '550e8400-e29b-41d4-a716-446655440008'; to = '550e8400-e29b-41d4-a716-446655440010'; attributes = [ordered]@{ date = $null } },
        [ordered]@{ id = '550e8400-e29b-41d4-a716-446655441010'; type = 'biological_parent'; from = '550e8400-e29b-41d4-a716-446655440009'; to = '550e8400-e29b-41d4-a716-446655440010'; attributes = [ordered]@{ date = $null } },
        [ordered]@{ id = '550e8400-e29b-41d4-a716-446655441011'; type = 'biological_parent'; from = '550e8400-e29b-41d4-a716-446655440011'; to = '550e8400-e29b-41d4-a716-446655440012'; attributes = [ordered]@{ date = $null } },
        [ordered]@{ id = '550e8400-e29b-41d4-a716-446655441012'; type = 'biological_parent'; from = '550e8400-e29b-41d4-a716-446655440012'; to = '550e8400-e29b-41d4-a716-446655440013'; attributes = [ordered]@{ date = $null } },
        [ordered]@{ id = '550e8400-e29b-41d4-a716-446655441013'; type = 'biological_parent'; from = '550e8400-e29b-41d4-a716-446655440013'; to = '550e8400-e29b-41d4-a716-446655440011'; attributes = [ordered]@{ date = $null } },
        [ordered]@{ id = '550e8400-e29b-41d4-a716-446655441014'; type = 'biological_parent'; from = '550e8400-e29b-41d4-a716-446655449999'; to = '550e8400-e29b-41d4-a716-446655440003'; attributes = [ordered]@{ date = $null } },
        [ordered]@{ id = '550e8400-e29b-41d4-a716-446655441015'; type = 'biological_parent'; from = '550e8400-e29b-41d4-a716-446655440003'; to = '550e8400-e29b-41d4-a716-446655440003'; attributes = [ordered]@{ date = $null } },
        [ordered]@{ id = '550e8400-e29b-41d4-a716-446655441016'; type = 'adoption'; from = '550e8400-e29b-41d4-a716-446655440006'; to = '550e8400-e29b-41d4-a716-446655440005'; attributes = [ordered]@{ date = [ordered]@{ era = 'Fourth Age'; year = 2 } } }
    )

    $events = @(
        [ordered]@{ id = '550e8400-e29b-41d4-a716-446655442001'; type = 'marriage'; date = [ordered]@{ era = 'Third Age'; year = 3019 }; participants = @('550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440004'); metadata = [ordered]@{} },
        [ordered]@{ id = '550e8400-e29b-41d4-a716-446655442002'; type = 'coronation'; date = [ordered]@{ era = 'Fourth Age'; year = 1 }; participants = @('550e8400-e29b-41d4-a716-446655440003'); metadata = [ordered]@{} }
    )

    $manifest = [ordered]@{
        scenarios = @(
            [ordered]@{
                name = 'mvp_core'
                description = 'Contract scenario for deterministic validation and first render.'
                contract = $true
                input = [ordered]@{
                    persons = $persons.id
                    relations = $relations.id
                }
                expected = [ordered]@{
                    ignoredRelations = @(
                        '550e8400-e29b-41d4-a716-446655441008',
                        '550e8400-e29b-41d4-a716-446655441009',
                        '550e8400-e29b-41d4-a716-446655441010',
                        '550e8400-e29b-41d4-a716-446655441013',
                        '550e8400-e29b-41d4-a716-446655441014',
                        '550e8400-e29b-41d4-a716-446655441015'
                    )
                    warnings = @('cycle_detected', 'missing_reference', 'over_parent', 'self_parent')
                    status = 'warning'
                }
            },
            [ordered]@{
                name = 'exploratory_layout'
                description = 'Broader manual exploration scenario with the same dataset.'
                contract = $false
                input = [ordered]@{
                    persons = @(
                        '550e8400-e29b-41d4-a716-446655440001',
                        '550e8400-e29b-41d4-a716-446655440003',
                        '550e8400-e29b-41d4-a716-446655440004',
                        '550e8400-e29b-41d4-a716-446655440005'
                    )
                    relations = @(
                        '550e8400-e29b-41d4-a716-446655441001',
                        '550e8400-e29b-41d4-a716-446655441004',
                        '550e8400-e29b-41d4-a716-446655441005',
                        '550e8400-e29b-41d4-a716-446655441006'
                    )
                }
            }
        )
    }

    [ordered]@{
        persons = [ordered]@{ items = $persons }
        relations = [ordered]@{ items = $relations }
        events = [ordered]@{ items = $events }
        manifest = $manifest
    }
}

function Export-TestingDataset {
    [CmdletBinding()]
    param(
        [string] $RootPath,
        [switch] $Force
    )

    $testingPath = Get-LegendariumTestingPath -RootPath $RootPath
    $dataset = Get-EmbeddedDemoDataset
    $targets = @(
        (Join-Path $testingPath 'persons\index.json')
        (Join-Path $testingPath 'relations\index.json')
        (Join-Path $testingPath 'events\index.json')
        (Join-Path $testingPath 'scenario-manifest.json')
    )

    if (-not $Force) {
        foreach ($target in $targets) {
            if (Test-Path -LiteralPath $target) {
                throw "Refusing to overwrite existing testing file: $target. Use -Force to replace it."
            }
        }
    }

    Write-LegendariumJsonFile -Path (Join-Path $testingPath 'persons\index.json') -Value $dataset.persons
    Write-LegendariumJsonFile -Path (Join-Path $testingPath 'relations\index.json') -Value $dataset.relations
    Write-LegendariumJsonFile -Path (Join-Path $testingPath 'events\index.json') -Value $dataset.events
    Write-LegendariumJsonFile -Path (Join-Path $testingPath 'scenario-manifest.json') -Value $dataset.manifest

    [pscustomobject]@{
        DatasetName = 'testing'
        DatasetPath = $testingPath
        Files = $targets
        Replaced = [bool] $Force
    }
}

function Export-DemoDataset {
    [CmdletBinding()]
    param(
        [string] $RootPath,
        [switch] $Force
    )

    Export-TestingDataset -RootPath $RootPath -Force:$Force
}

function Import-LegendariumDataset {
    [CmdletBinding()]
    param(
        [string] $RootPath,
        [ValidateSet('testing', 'demo', 'prod')]
        [string] $DatasetName = 'prod',
        [switch] $AllowMissing
    )

    $datasetRoot = Get-LegendariumDatasetPath -RootPath $RootPath -DatasetName $DatasetName

    $personsPath = Join-Path $datasetRoot 'persons\index.json'
    $relationsPath = Join-Path $datasetRoot 'relations\index.json'
    $eventsPath = Join-Path $datasetRoot 'events\index.json'
    $manifestPath = Join-Path $datasetRoot 'scenario-manifest.json'

    foreach ($path in @($personsPath, $relationsPath, $eventsPath, $manifestPath)) {
        if (-not (Test-Path -LiteralPath $path)) {
            if ($AllowMissing) {
                return [pscustomobject] (New-EmptyLegendariumDataset)
            }

            throw "Dataset file is missing: $path"
        }
    }

    $persons = (Get-Content -LiteralPath $personsPath -Raw | ConvertFrom-Json -AsHashtable).items
    $relations = (Get-Content -LiteralPath $relationsPath -Raw | ConvertFrom-Json -AsHashtable).items
    $events = (Get-Content -LiteralPath $eventsPath -Raw | ConvertFrom-Json -AsHashtable).items
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json -AsHashtable

    [pscustomobject]@{
        persons = @(Sort-ById -Items $persons)
        relations = @(Sort-ById -Items $relations)
        events = @(Sort-ById -Items $events)
        manifest = $manifest
    }
}

function Get-LegendariumPerson {
    [CmdletBinding(DefaultParameterSetName = 'ByName')]
    param(
        [string] $RootPath,

        [ValidateSet('testing', 'demo', 'prod')]
        [string] $DatasetName = 'prod',

        [Parameter(Mandatory, ParameterSetName = 'ById')]
        [string] $Id,

        [Parameter(Mandatory, ParameterSetName = 'ByName')]
        [string] $Name,

        [switch] $Exact
    )

    $dataset = Import-LegendariumDataset -RootPath $RootPath -DatasetName $DatasetName

    if ($PSCmdlet.ParameterSetName -eq 'ById') {
        return @($dataset.persons | Where-Object { [string] $_.id -eq $Id })
    }

    if ($Exact) {
        return @($dataset.persons | Where-Object { [string] $_.name -eq $Name })
    }

    return @($dataset.persons | Where-Object { [string] $_.name -like "*$Name*" })
}

function Add-LegendariumPerson {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Name,

        [string] $RootPath,

        [ValidateSet('testing', 'demo', 'prod')]
        [string] $DatasetName = 'prod',

        [string[]] $Houses = @(),

        [string] $Description,

        [object[]] $SourceLinks = @(),

        [string] $PortraitUrl,

        [string] $PortraitSourceLabel,

        [string] $PortraitSourceUrl,

        [string] $BirthEra,

        [Nullable[int]] $BirthYear,

        [string] $DeathEra,

        [Nullable[int]] $DeathYear
    )

    $dataset = Import-LegendariumDataset -RootPath $RootPath -DatasetName $DatasetName -AllowMissing
    $normalizedSourceLinks = @(ConvertTo-LegendariumSourceLinks -SourceLinks $SourceLinks)
    $person = [ordered]@{
        id = (New-LegendariumUuid)
        name = $Name
        birth = New-TimeValue -Era $BirthEra -Year $BirthYear -FieldName 'Birth'
        death = New-TimeValue -Era $DeathEra -Year $DeathYear -FieldName 'Death'
        houses = @($Houses)
        metadata = [ordered]@{
            description = if ([string]::IsNullOrWhiteSpace($Description)) { $null } else { $Description }
        }
    }

    if ($normalizedSourceLinks.Count -gt 0) {
        $person.sourceLinks = $normalizedSourceLinks
    }

    $portraitUrlValue = ConvertTo-OptionalLegendariumString -Value $PortraitUrl
    if ($null -ne $portraitUrlValue) {
        $person.portraitUrl = $portraitUrlValue
    }

    $portraitSourceLabelValue = ConvertTo-OptionalLegendariumString -Value $PortraitSourceLabel
    if ($null -ne $portraitSourceLabelValue) {
        $person.portraitSourceLabel = $portraitSourceLabelValue
    }

    $portraitSourceUrlValue = ConvertTo-OptionalLegendariumString -Value $PortraitSourceUrl
    if ($null -ne $portraitSourceUrlValue) {
        $person.portraitSourceUrl = $portraitSourceUrlValue
    }

    $dataset.persons = @($dataset.persons) + $person
    $null = Save-LegendariumDataset -Dataset $dataset -RootPath $RootPath -DatasetName $DatasetName

    [pscustomobject]$person
}

function Add-LegendariumMarriage {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $FirstPersonId,

        [Parameter(Mandatory)]
        [string] $SecondPersonId,

        [string] $RootPath,

        [ValidateSet('testing', 'demo', 'prod')]
        [string] $DatasetName = 'prod',

        [string] $Era,

        [Nullable[int]] $Year
    )

    if ($FirstPersonId -eq $SecondPersonId) {
        throw 'Marriage requires two distinct person ids.'
    }

    $dataset = Import-LegendariumDataset -RootPath $RootPath -DatasetName $DatasetName -AllowMissing
    Assert-PersonExists -Persons $dataset.persons -PersonIds @($FirstPersonId, $SecondPersonId)
    $date = New-TimeValue -Era $Era -Year $Year -FieldName 'Marriage'

    $relation = [ordered]@{
        id = (New-LegendariumUuid)
        type = 'marriage'
        from = $FirstPersonId
        to = $SecondPersonId
        attributes = [ordered]@{
            date = $date
        }
    }

    $event = [ordered]@{
        id = (New-LegendariumUuid)
        type = 'marriage'
        date = $date
        participants = @($FirstPersonId, $SecondPersonId)
        metadata = [ordered]@{}
    }

    $dataset.relations = @($dataset.relations) + $relation
    $dataset.events = @($dataset.events) + $event
    $null = Save-LegendariumDataset -Dataset $dataset -RootPath $RootPath -DatasetName $DatasetName

    [pscustomobject]@{
        relation = [pscustomobject]$relation
        event = [pscustomobject]$event
    }
}

function Add-LegendariumChild {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Name,

        [Parameter(Mandatory)]
        [string[]] $ParentIds,

        [string] $RootPath,

        [ValidateSet('testing', 'demo', 'prod')]
        [string] $DatasetName = 'prod',

        [string[]] $Houses = @(),

        [string] $Description,

        [object[]] $SourceLinks = @(),

        [string] $PortraitUrl,

        [string] $PortraitSourceLabel,

        [string] $PortraitSourceUrl,

        [string] $BirthEra,

        [Nullable[int]] $BirthYear,

        [string] $DeathEra,

        [Nullable[int]] $DeathYear
    )

    $distinctParentIds = @($ParentIds | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Sort-Object -Unique)
    if ($distinctParentIds.Count -lt 1 -or $distinctParentIds.Count -gt 2) {
        throw 'Add-LegendariumChild requires one or two distinct parent ids.'
    }

    $dataset = Import-LegendariumDataset -RootPath $RootPath -DatasetName $DatasetName -AllowMissing
    Assert-PersonExists -Persons $dataset.persons -PersonIds $distinctParentIds
    $normalizedSourceLinks = @(ConvertTo-LegendariumSourceLinks -SourceLinks $SourceLinks)

    $child = [ordered]@{
        id = (New-LegendariumUuid)
        name = $Name
        birth = New-TimeValue -Era $BirthEra -Year $BirthYear -FieldName 'Birth'
        death = New-TimeValue -Era $DeathEra -Year $DeathYear -FieldName 'Death'
        houses = @($Houses)
        metadata = [ordered]@{
            description = if ([string]::IsNullOrWhiteSpace($Description)) { $null } else { $Description }
        }
    }

    if ($normalizedSourceLinks.Count -gt 0) {
        $child.sourceLinks = $normalizedSourceLinks
    }

    $portraitUrlValue = ConvertTo-OptionalLegendariumString -Value $PortraitUrl
    if ($null -ne $portraitUrlValue) {
        $child.portraitUrl = $portraitUrlValue
    }

    $portraitSourceLabelValue = ConvertTo-OptionalLegendariumString -Value $PortraitSourceLabel
    if ($null -ne $portraitSourceLabelValue) {
        $child.portraitSourceLabel = $portraitSourceLabelValue
    }

    $portraitSourceUrlValue = ConvertTo-OptionalLegendariumString -Value $PortraitSourceUrl
    if ($null -ne $portraitSourceUrlValue) {
        $child.portraitSourceUrl = $portraitSourceUrlValue
    }

    $parentRelations = @()
    foreach ($parentId in $distinctParentIds) {
        $parentRelations += [ordered]@{
            id = (New-LegendariumUuid)
            type = 'biological_parent'
            from = $parentId
            to = $child.id
            attributes = [ordered]@{
                date = $child.birth
            }
        }
    }

    $dataset.persons = @($dataset.persons) + $child
    $dataset.relations = @($dataset.relations) + $parentRelations
    $null = Save-LegendariumDataset -Dataset $dataset -RootPath $RootPath -DatasetName $DatasetName

    [pscustomobject]@{
        child = [pscustomobject]$child
        parentRelations = @($parentRelations | ForEach-Object { [pscustomobject]$_ })
    }
}

function Sort-ById {
    [CmdletBinding()]
    param(
        [AllowEmptyCollection()]
        [object[]] $Items = @()
    )

    if ($null -eq $Items -or $Items.Count -eq 0) {
        return @()
    }

    $Items | Sort-Object -Property { $_.id }
}

function Build-ParentsByChild {
    param([object[]] $Relations)

    $map = @{}
    foreach ($relation in $Relations) {
        if (-not $map.ContainsKey($relation.to)) {
            $map[$relation.to] = New-Object System.Collections.Generic.List[string]
        }

        $null = $map[$relation.to].Add([string] $relation.from)
        $map[$relation.to].Sort()
    }

    $map
}

function Build-ChildrenByParent {
    param([object[]] $Relations)

    $map = @{}
    foreach ($relation in $Relations) {
        if (-not $map.ContainsKey($relation.from)) {
            $map[$relation.from] = New-Object System.Collections.Generic.List[string]
        }

        $null = $map[$relation.from].Add([string] $relation.to)
        $map[$relation.from].Sort()
    }

    $map
}

function Compare-WarningKey {
    param($Warning)

    "{0}|{1}|{2}|{3}" -f $Warning.code, ($Warning.relationId ?? ''), ($Warning.personId ?? ''), $Warning.message
}

function Get-CycleEdgeIds {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object[]] $Relations
    )

    $adjacency = @{}
    foreach ($relation in $Relations) {
        if (-not $adjacency.ContainsKey($relation.from)) {
            $adjacency[$relation.from] = New-Object System.Collections.Generic.List[string]
        }

        $null = $adjacency[$relation.from].Add([string] $relation.to)
        $adjacency[$relation.from].Sort()
    }

    $indexByNode = @{}
    $lowLinkByNode = @{}
    $stack = New-Object System.Collections.Generic.List[string]
    $onStack = New-Object System.Collections.Generic.HashSet[string]
    $cycleEdgeIds = New-Object System.Collections.Generic.HashSet[string]
    $index = 0

    $strongConnect = $null
    $strongConnect = {
        param([string] $NodeId)

        $indexByNode[$NodeId] = $index
        $lowLinkByNode[$NodeId] = $index
        $index += 1
        $null = $stack.Add($NodeId)
        $null = $onStack.Add($NodeId)

        foreach ($childId in ($adjacency[$NodeId] ?? @())) {
            if (-not $indexByNode.ContainsKey($childId)) {
                & $strongConnect $childId
                $lowLinkByNode[$NodeId] = [Math]::Min([int] $lowLinkByNode[$NodeId], [int] $lowLinkByNode[$childId])
            }
            elseif ($onStack.Contains($childId)) {
                $lowLinkByNode[$NodeId] = [Math]::Min([int] $lowLinkByNode[$NodeId], [int] $indexByNode[$childId])
            }
        }

        if ([int] $lowLinkByNode[$NodeId] -ne [int] $indexByNode[$NodeId]) {
            return
        }

        $component = New-Object System.Collections.Generic.List[string]
        while ($stack.Count -gt 0) {
            $lastIndex = $stack.Count - 1
            $stackedNode = $stack[$lastIndex]
            $stack.RemoveAt($lastIndex)
            $null = $onStack.Remove($stackedNode)
            $null = $component.Add($stackedNode)

            if ($stackedNode -eq $NodeId) {
                break
            }
        }

        if ($component.Count -lt 2) {
            return
        }

        $componentSet = New-Object System.Collections.Generic.HashSet[string]
        foreach ($componentNode in $component) {
            $null = $componentSet.Add($componentNode)
        }

        foreach ($relation in $Relations) {
            if ($componentSet.Contains([string] $relation.from) -and $componentSet.Contains([string] $relation.to)) {
                $null = $cycleEdgeIds.Add([string] $relation.id)
            }
        }
    }

    $nodes = @()
    foreach ($relation in $Relations) {
        $nodes += [string] $relation.from
        $nodes += [string] $relation.to
    }

    foreach ($nodeId in ($nodes | Sort-Object -Unique)) {
        if (-not $indexByNode.ContainsKey($nodeId)) {
            & $strongConnect $nodeId
        }
    }

    @($cycleEdgeIds | Sort-Object)
}

function Get-DisconnectedComponentsCount {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object[]] $Persons,

        [Parameter(Mandatory)]
        [object[]] $Relations
    )

    $adjacency = @{}
    foreach ($person in $Persons) {
        $adjacency[$person.id] = New-Object System.Collections.Generic.List[string]
    }

    foreach ($relation in $Relations) {
        if ($adjacency.ContainsKey($relation.from)) {
            $null = $adjacency[$relation.from].Add([string] $relation.to)
        }

        if ($adjacency.ContainsKey($relation.to)) {
            $null = $adjacency[$relation.to].Add([string] $relation.from)
        }
    }

    $visited = New-Object System.Collections.Generic.HashSet[string]
    $components = 0

    foreach ($person in ($Persons | Sort-Object -Property id)) {
        if ($visited.Contains([string] $person.id)) {
            continue
        }

        $components += 1
        $queue = [System.Collections.Generic.Queue[string]]::new()
        $queue.Enqueue([string] $person.id)
        $null = $visited.Add([string] $person.id)

        while ($queue.Count -gt 0) {
            $nodeId = $queue.Dequeue()
            foreach ($neighborId in ($adjacency[$nodeId] ?? @())) {
                if (-not $visited.Contains($neighborId)) {
                    $null = $visited.Add($neighborId)
                    $queue.Enqueue($neighborId)
                }
            }
        }
    }

    $components
}

function Invoke-LegendariumValidation {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Dataset
    )

    $persons = @($Dataset.persons | Sort-Object -Property id)
    $relations = @($Dataset.relations | Sort-Object -Property id)
    $personById = @{}
    foreach ($person in $persons) {
        $personById[[string] $person.id] = $person
    }

    $validOverlayRelations = New-Object System.Collections.Generic.List[object]
    $biologicalCandidates = New-Object System.Collections.Generic.List[object]
    $ignoredRelations = New-Object System.Collections.Generic.List[object]
    $warnings = New-Object System.Collections.Generic.List[object]

    foreach ($relation in $relations) {
        $fromExists = $personById.ContainsKey([string] $relation.from)
        $toExists = $personById.ContainsKey([string] $relation.to)

        if (-not $fromExists -or -not $toExists) {
            $ignoredRelations.Add([pscustomobject]@{ relationId = [string] $relation.id; reason = 'missing_reference' })
            $warnings.Add([pscustomobject]@{
                    code = 'missing_reference'
                    message = "Relation $($relation.id) references a missing person and was ignored."
                    relationId = [string] $relation.id
                    personId = $null
                    relatedIds = @([string] $relation.from, [string] $relation.to)
                })
            continue
        }

        if ($relation.type -eq 'biological_parent' -and $relation.from -eq $relation.to) {
            $ignoredRelations.Add([pscustomobject]@{ relationId = [string] $relation.id; reason = 'self_parent' })
            $warnings.Add([pscustomobject]@{
                    code = 'self_parent'
                    message = "Relation $($relation.id) is a self-parent edge and was ignored."
                    relationId = [string] $relation.id
                    personId = [string] $relation.from
                    relatedIds = @([string] $relation.from)
                })
            continue
        }

        if ($relation.type -eq 'biological_parent') {
            $biologicalCandidates.Add($relation)
            continue
        }

        $validOverlayRelations.Add($relation)
    }

    $groupedByChild = @{}
    foreach ($relation in $biologicalCandidates) {
        if (-not $groupedByChild.ContainsKey($relation.to)) {
            $groupedByChild[$relation.to] = New-Object System.Collections.Generic.List[object]
        }

        $groupedByChild[$relation.to].Add($relation)
    }

    $overParentChildren = New-Object System.Collections.Generic.HashSet[string]
    foreach ($childId in ($groupedByChild.Keys | Sort-Object)) {
        $relationsForChild = $groupedByChild[$childId]
        if ($relationsForChild.Count -gt 2) {
            $null = $overParentChildren.Add([string] $childId)
            $warnings.Add([pscustomobject]@{
                    code = 'over_parent'
                    message = "Person $childId has more than two biological parents; all such layout edges were ignored."
                    relationId = $null
                    personId = [string] $childId
                    relatedIds = @($relationsForChild | Sort-Object -Property id | ForEach-Object { [string] $_.id })
                })

            foreach ($relation in $relationsForChild) {
                $ignoredRelations.Add([pscustomobject]@{ relationId = [string] $relation.id; reason = 'over_parent' })
            }
        }
    }

    $validBiologicalRelations = @($biologicalCandidates | Where-Object { -not $overParentChildren.Contains([string] $_.to) } | Sort-Object -Property id)

    while ($true) {
        $cycleEdgeIds = @(Get-CycleEdgeIds -Relations $validBiologicalRelations)
        if ($cycleEdgeIds.Count -eq 0) {
            break
        }

        $relationId = $cycleEdgeIds[-1]
        $validBiologicalRelations = @($validBiologicalRelations | Where-Object { $_.id -ne $relationId } | Sort-Object -Property id)
        $ignoredRelations.Add([pscustomobject]@{ relationId = [string] $relationId; reason = 'cycle' })
        $warnings.Add([pscustomobject]@{
                code = 'cycle_detected'
                message = "Cycle detected in biological lineage; relation $relationId was ignored."
                relationId = [string] $relationId
                personId = $null
                relatedIds = @($cycleEdgeIds)
            })
    }

    $sortedIgnoredRelations = @($ignoredRelations | Sort-Object -Property relationId)
    $sortedWarnings = @($warnings | Sort-Object -Property { Compare-WarningKey $_ })

    [pscustomobject]@{
        persons = $persons
        relations = $relations
        events = $Dataset.events
        validBiologicalRelations = $validBiologicalRelations
        validOverlayRelations = @($validOverlayRelations | Sort-Object -Property id)
        ignoredRelations = $sortedIgnoredRelations
        warnings = $sortedWarnings
        disconnectedComponents = Get-DisconnectedComponentsCount -Persons $persons -Relations $validBiologicalRelations
        status = if ($sortedWarnings.Count -gt 0) { 'warning' } else { 'ok' }
    }
}

function Test-ScenarioContract {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [hashtable] $Scenario,

        [Parameter(Mandatory)]
        [object] $Validation
    )

    $actual = [ordered]@{
        ignoredRelations = @($Validation.ignoredRelations | ForEach-Object { [string] $_.relationId })
        warnings = @($Validation.warnings | ForEach-Object { [string] $_.code } | Sort-Object -Unique)
        disconnectedComponents = [int] $Validation.disconnectedComponents
        status = [string] $Validation.status
    }

    $mismatches = New-Object System.Collections.Generic.List[string]
    $expected = $Scenario.expected

    if ($null -ne $expected) {
        if ($expected.ContainsKey('ignoredRelations')) {
            $left = @($expected.ignoredRelations | Sort-Object)
            $right = @($actual.ignoredRelations | Sort-Object)
            if ((ConvertTo-Json $left -Compress) -ne (ConvertTo-Json $right -Compress)) {
                $mismatches.Add('ignoredRelations mismatch')
            }
        }

        if ($expected.ContainsKey('warnings')) {
            $left = @($expected.warnings | Sort-Object)
            $right = @($actual.warnings | Sort-Object)
            if ((ConvertTo-Json $left -Compress) -ne (ConvertTo-Json $right -Compress)) {
                $mismatches.Add('warnings mismatch')
            }
        }

        if ($expected.ContainsKey('disconnectedComponents') -and [int] $expected.disconnectedComponents -ne [int] $actual.disconnectedComponents) {
            $mismatches.Add('disconnectedComponents mismatch')
        }

        if ($expected.ContainsKey('status') -and [string] $expected.status -ne [string] $actual.status) {
            $mismatches.Add('status mismatch')
        }
    }

    [pscustomobject]@{
        name = [string] $Scenario.name
        contract = [bool] $Scenario.contract
        passed = ($mismatches.Count -eq 0)
        actual = [pscustomobject] $actual
        mismatches = @($mismatches)
    }
}

function Invoke-TestingValidation {
    [CmdletBinding()]
    param(
        [string] $RootPath,
        [string] $ScenarioName
    )

    $dataset = Import-LegendariumDataset -RootPath $RootPath -DatasetName 'testing'
    $validation = Invoke-LegendariumValidation -Dataset $dataset

    $scenarios = @($dataset.manifest.scenarios)
    if ($ScenarioName) {
        $scenarios = @($scenarios | Where-Object { $_.name -eq $ScenarioName })
        if ($scenarios.Count -eq 0) {
            throw "Scenario not found: $ScenarioName"
        }
    }

    $evaluations = @()
    foreach ($scenario in $scenarios) {
        if ([bool] $scenario.contract) {
            $evaluations += Test-ScenarioContract -Scenario $scenario -Validation $validation
        }
        else {
            $evaluations += [pscustomobject]@{
                name = [string] $scenario.name
                contract = $false
                passed = $true
                actual = $null
                mismatches = @()
            }
        }
    }

    [pscustomobject]@{
        dataset = 'testing'
        status = [string] $validation.status
        ignoredRelations = @($validation.ignoredRelations)
        warnings = @($validation.warnings)
        disconnectedComponents = [int] $validation.disconnectedComponents
        contractResults = @($evaluations)
    }
}

function New-LegendariumScenarioManifestSkeleton {
    [CmdletBinding()]
    param(
        [string] $RootPath,

        [ValidateSet('testing', 'demo', 'prod')]
        [string] $DatasetName = 'testing',

        [string] $ScenarioName = 'dataset_overview',

        [string] $Description = 'Generated scenario skeleton for the current dataset.',

        [switch] $Contract
    )

    $dataset = Import-LegendariumDataset -RootPath $RootPath -DatasetName $DatasetName -AllowMissing
    $validation = Invoke-LegendariumValidation -Dataset $dataset

    [pscustomobject]@{
        scenarios = @(
            [ordered]@{
                name = $ScenarioName
                description = $Description
                contract = [bool] $Contract
                input = [ordered]@{
                    persons = @($dataset.persons | Sort-Object -Property id | ForEach-Object { [string] $_.id })
                    relations = @($dataset.relations | Sort-Object -Property id | ForEach-Object { [string] $_.id })
                }
                expected = if ($Contract) {
                    [ordered]@{
                        ignoredRelations = @($validation.ignoredRelations | Sort-Object -Property relationId | ForEach-Object { [string] $_.relationId })
                        warnings = @($validation.warnings | ForEach-Object { [string] $_.code } | Sort-Object -Unique)
                        disconnectedComponents = [int] $validation.disconnectedComponents
                        status = [string] $validation.status
                    }
                }
                else {
                    [ordered]@{}
                }
            }
        )
    }
}

function Test-LegendariumScenarioManifest {
    [CmdletBinding()]
    param(
        [string] $RootPath,

        [ValidateSet('testing', 'demo', 'prod')]
        [string] $DatasetName = 'testing'
    )

    $dataset = Import-LegendariumDataset -RootPath $RootPath -DatasetName $DatasetName -AllowMissing
    $personIds = New-Object System.Collections.Generic.HashSet[string]
    $relationIds = New-Object System.Collections.Generic.HashSet[string]

    foreach ($person in @($dataset.persons)) {
        $null = $personIds.Add([string] $person.id)
    }

    foreach ($relation in @($dataset.relations)) {
        $null = $relationIds.Add([string] $relation.id)
    }

    $issues = New-Object System.Collections.Generic.List[object]
    $scenarios = @($dataset.manifest.scenarios)
    $scenarioNameGroups = $scenarios | Group-Object -Property name

    foreach ($group in @($scenarioNameGroups | Where-Object { $_.Name -and $_.Count -gt 1 })) {
        $issues.Add([pscustomobject]@{
                scenario = [string] $group.Name
                kind = 'duplicate_scenario_name'
                id = [string] $group.Name
                message = "Scenario name $($group.Name) appears $($group.Count) times."
            })
    }

    foreach ($scenario in $scenarios) {
        foreach ($personId in @($scenario.input.persons)) {
            if (-not $personIds.Contains([string] $personId)) {
                $issues.Add([pscustomobject]@{
                        scenario = [string] $scenario.name
                        kind = 'missing_person'
                        id = [string] $personId
                        message = "Scenario $($scenario.name) references missing person id $personId."
                    })
            }
        }

        foreach ($relationId in @($scenario.input.relations)) {
            if (-not $relationIds.Contains([string] $relationId)) {
                $issues.Add([pscustomobject]@{
                        scenario = [string] $scenario.name
                        kind = 'missing_relation'
                        id = [string] $relationId
                        message = "Scenario $($scenario.name) references missing relation id $relationId."
                    })
            }
        }
    }

    $issueArray = @(foreach ($issue in $issues) {
        $issue
    })

    [pscustomobject]@{
        dataset = $DatasetName
        scenarioCount = $scenarios.Count
        issueCount = @($issueArray).Count
        passed = (@($issueArray).Count -eq 0)
        issues = @($issueArray)
    }
}

function Invoke-DemoValidation {
    [CmdletBinding()]
    param(
        [string] $RootPath,
        [string] $ScenarioName
    )

    Invoke-TestingValidation -RootPath $RootPath -ScenarioName $ScenarioName
}

Export-ModuleMember -Function @(
    'New-LegendariumUuid',
    'Import-LegendariumDataset',
    'Get-LegendariumPerson',
    'New-LegendariumScenarioManifestSkeleton',
    'Test-LegendariumScenarioManifest',
    'Invoke-TestingValidation',
    'Invoke-DemoValidation',
    'Export-TestingDataset',
    'Export-DemoDataset',
    'Add-LegendariumPerson',
    'Add-LegendariumMarriage',
    'Add-LegendariumChild'
)