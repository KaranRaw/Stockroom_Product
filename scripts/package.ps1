# Run on your personal machine. Includes source and screenshots, excludes runtime data and secrets.
param([string]$OutputPath = (Join-Path (Split-Path $PSScriptRoot -Parent) '..\stockroom-source.zip'))
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Split-Path $PSScriptRoot -Parent))
$output = [IO.Path]::GetFullPath($OutputPath)
if ($output.StartsWith($projectRoot + '\', [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Choose an output ZIP path outside the project folder.'
}
if (Test-Path -LiteralPath $output) { throw "Output already exists: $output" }
Add-Type -AssemblyName System.IO.Compression
$excluded = @('.git','node_modules','.venv','runtime-env','.tools','dist','test-results','playwright-report','__pycache__','.pytest_cache','.ruff_cache')
$stream = [IO.File]::Open($output, [IO.FileMode]::CreateNew)
$archive = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Create)
try {
    $pending = [Collections.Generic.Stack[string]]::new()
    $pending.Push($projectRoot)
    while ($pending.Count -gt 0) {
        $directory = $pending.Pop()
        foreach ($item in Get-ChildItem -LiteralPath $directory -Force) {
            if ($item.PSIsContainer) {
                if ($item.Name -notin $excluded) { $pending.Push($item.FullName) }
                continue
            }
            if (($item.Name -like '.env*' -and $item.Name -ne '.env.example') -or
                $item.Extension -in @('.zip','.log','.pyc','.tsbuildinfo')) { continue }
            $relative = $item.FullName.Substring($projectRoot.Length + 1).Replace('\','/')
            $entry = $archive.CreateEntry($relative, [IO.Compression.CompressionLevel]::Optimal)
            $source = [IO.File]::OpenRead($item.FullName)
            $destination = $entry.Open()
            try { $source.CopyTo($destination) }
            finally { $source.Dispose(); $destination.Dispose() }
        }
    }
} finally { $archive.Dispose(); $stream.Dispose() }
Write-Output "Source ZIP created: $output"
