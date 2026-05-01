$ErrorActionPreference = 'Stop'

$proxyDir    = Split-Path -Parent $MyInvocation.MyCommand.Path
$stagingDir  = Join-Path $proxyDir '.azure-package'
$zipPath     = Join-Path $proxyDir 'azure-function.zip'
$distEntry   = Join-Path $proxyDir 'dist\index.js'

if (-not (Test-Path $distEntry)) {
  throw "No se encontro $distEntry. Ejecuta primero: npm run build:proxy"
}

if (Test-Path $stagingDir) {
  Remove-Item -Path $stagingDir -Recurse -Force
}
New-Item -ItemType Directory -Path $stagingDir | Out-Null

# dist/index.js
$distDir = Join-Path $stagingDir 'dist'
New-Item -ItemType Directory -Path $distDir | Out-Null
Copy-Item -Path $distEntry -Destination (Join-Path $distDir 'index.js') -Force

# host.json (requerido por Azure Functions)
Copy-Item -Path (Join-Path $proxyDir 'host.json') -Destination (Join-Path $stagingDir 'host.json') -Force

# package.json con @azure/functions + mssql
@'
{
  "name": "fibot-azure-function",
  "private": true,
  "version": "1.0.0",
  "main": "dist/index.js",
  "dependencies": {
    "@azure/functions": "^4.5.0",
    "mssql": "^12.2.0"
  }
}
'@ | Set-Content -Path (Join-Path $stagingDir 'package.json') -Encoding ASCII

Push-Location $stagingDir
npm install --omit=dev | Out-Host
Pop-Location

if (Test-Path $zipPath) {
  Remove-Item -Path $zipPath -Force
}

Compress-Archive -Path (Join-Path $stagingDir '*') -DestinationPath $zipPath -Force
Write-Host "Azure Function package generated: $zipPath"
Write-Host ""
Write-Host "Para desplegar en Azure:"
Write-Host "  az functionapp deployment source config-zip --resource-group <RG> --name <FUNCTION_APP_NAME> --src azure-function.zip"
