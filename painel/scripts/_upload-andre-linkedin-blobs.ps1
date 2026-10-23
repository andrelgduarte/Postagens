# Sobe as mídias de staging/andre-li para o Vercel Blob usando a sessão logada
# (vercel blob put) e grava staging/andre-li/_blobmap.json com { slug: { arquivo: url } }.
# Uso: pwsh scripts/_upload-andre-linkedin-blobs.ps1 -User user_3FGh29qmsB3VcOGjO62SBGZZm15
param(
  [Parameter(Mandatory = $true)][string]$User
)
$ErrorActionPreference = "Stop"
$stage = Join-Path $PSScriptRoot "..\staging\andre-li"
$stage = (Resolve-Path $stage).Path
$map = [ordered]@{}
$count = 0

Get-ChildItem -Path $stage -Directory | Sort-Object Name | ForEach-Object {
  $slug = $_.Name
  $imgs = Get-ChildItem -Path $_.FullName -File | Where-Object { $_.Extension -match '\.(png|jpe?g|webp)$' } | Sort-Object Name
  if ($imgs.Count -eq 0) { return }
  $map[$slug] = [ordered]@{}
  foreach ($img in $imgs) {
    $pathname = "media/$User/$slug/$($img.Name)"
    $out = vercel blob put "$($img.FullName)" --access public --pathname "$pathname" --allow-overwrite true 2>&1 | Out-String
    $url = ([regex]::Match($out, 'https://\S+public\.blob\.vercel-storage\.com/\S+')).Value
    if (-not $url) { Write-Error "Falha ao subir $pathname :`n$out" }
    $map[$slug][$img.Name] = $url
    $count++
    Write-Host "  ✓ $slug/$($img.Name)"
  }
}

$json = $map | ConvertTo-Json -Depth 5
$dest = Join-Path $stage "_blobmap.json"
Set-Content -Path $dest -Value $json -Encoding UTF8
Write-Host "`n$count arquivo(s) no Blob. Mapa: $dest"
