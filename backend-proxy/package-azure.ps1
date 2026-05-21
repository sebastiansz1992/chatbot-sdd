$ErrorActionPreference = 'Stop'

$proxyDir    = Split-Path -Parent $MyInvocation.MyCommand.Path
$stagingDir  = Join-Path $proxyDir '.azure-package'
$zipPath     = Join-Path $proxyDir 'azure-function.zip'
$distEntry   = Join-Path $proxyDir 'dist\index.js'

if (-not (Test-Path $distEntry)) {
  throw "No se encontro $distEntry. Ejecuta primero: npm run build:proxy"
}

# Copiar build compilado al staging de Azure
$destDist = Join-Path $stagingDir 'dist'
if (-not (Test-Path $destDist)) {
  New-Item -ItemType Directory -Path $destDist | Out-Null
}
Copy-Item -Path $distEntry -Destination (Join-Path $destDist 'index.js') -Force
Write-Host "Copiado dist/index.js a .azure-package/dist/"

# Instalar dependencias de produccion si no existen
$nodeModules = Join-Path $stagingDir 'node_modules'
if (-not (Test-Path $nodeModules)) {
  Write-Host "Instalando dependencias de produccion en .azure-package..."
  Push-Location $stagingDir
  npm install --omit=dev | Out-Host
  Pop-Location
}

# Generar ZIP
if (Test-Path $zipPath) {
  Remove-Item -Path $zipPath -Force
}
Compress-Archive -Path (Join-Path $stagingDir '*') -DestinationPath $zipPath -Force
Write-Host "Azure Function package generado: $zipPath"
