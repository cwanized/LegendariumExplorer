@{
    RootModule = 'LegendariumExplorer.psm1'
    ModuleVersion = '0.1.0'
    GUID = 'b91a7144-e3ec-4bc9-ab2f-c6cf66d36b8d'
    Author = 'GitHub Copilot'
    CompanyName = 'Local'
    Copyright = '(c) Local. All rights reserved.'
    Description = 'PowerShell tooling for deterministic Legendarium Explorer dataset generation, authoring, and validation across testing, demo, and prod.'
    PowerShellVersion = '7.2'
    FunctionsToExport = @(
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
    CmdletsToExport = @()
    VariablesToExport = @()
    AliasesToExport = @()
}