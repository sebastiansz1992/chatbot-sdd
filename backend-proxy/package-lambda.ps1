$ErrorActionPreference = 'Stop'

$proxyDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$stagingDir = Join-Path $proxyDir '.lambda-package'
$zipPath = Join-Path $proxyDir 'lambda.zip'
$distEntry = Join-Path $proxyDir 'dist\index.js'

if (-not (Test-Path $distEntry)) {
  throw "No se encontro $distEntry. Ejecuta primero: npm run build:proxy"
}

if (Test-Path $stagingDir) {
  Remove-Item -Path $stagingDir -Recurse -Force
}

New-Item -ItemType Directory -Path $stagingDir | Out-Null
Copy-Item -Path $distEntry -Destination (Join-Path $stagingDir 'index.js') -Force

@'
{
  "name": "fibot-backend-proxy-lambda",
  "private": true,
  "version": "1.0.0",
  "dependencies": {
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
Write-Host "Lambda package generated: $zipPath"
