Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function ConvertTo-SafeSlug {
    param([string]$Name)
    $slug = $Name.ToLowerInvariant()
    $slug = [System.Text.RegularExpressions.Regex]::Replace($slug, '[^a-z0-9]+', '-')
    $slug = $slug.Trim('-')
    return $slug
}

function Migrate-Collection {
    param(
        [string]$RolePath,
        [string]$Type
    )

    $indexPath = Join-Path $RolePath "$Type\index.json"
    if (-not (Test-Path -LiteralPath $indexPath)) {
        Write-Output "  $Type : no index.json, skipping"
        return
    }

    $raw = Get-Content -LiteralPath $indexPath -Raw | ConvertFrom-Json
    $items = @($raw.items)

    # Check if already migrated (items are strings, not objects)
    if ($items.Count -gt 0 -and $items[0] -is [string]) {
        Write-Output "  $Type : already migrated ($($items.Count) entries)"
        return
    }

    $fileNames = @()
    foreach ($item in $items) {
        $id = $item.id
        $name = $item.PSObject.Properties['name']?.Value
        if ($name) {
            $slug = ConvertTo-SafeSlug -Name $name
            $fileName = "${id}_${slug}.json"
        } else {
            $fileName = "${id}.json"
        }
        $filePath = Join-Path $RolePath "$Type\$fileName"
        $itemJson = $item | ConvertTo-Json -Depth 20
        Set-Content -LiteralPath $filePath -Value $itemJson -Encoding utf8NoBOM
        $fileNames += $fileName
    }

    $sorted = @($fileNames | Sort-Object)
    $newIndexContent = [ordered]@{ items = $sorted } | ConvertTo-Json -Depth 3 -Compress
    Set-Content -LiteralPath $indexPath -Value $newIndexContent -Encoding utf8NoBOM

    Write-Output "  $Type : wrote $($sorted.Count) item files + index"
}

$root = Split-Path -Parent $PSScriptRoot
$roles = @('testing', 'demo', 'prod')
$types = @('persons', 'relations', 'events')

foreach ($role in $roles) {
    Write-Output "=== $role ==="
    $rolePath = Join-Path $root "datasets\$role"
    foreach ($type in $types) {
        Migrate-Collection -RolePath $rolePath -Type $type
    }
}

Write-Output ""
Write-Output "Migration complete."
