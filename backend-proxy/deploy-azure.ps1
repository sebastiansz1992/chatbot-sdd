# deploy-azure.ps1
# Empaqueta y despliega el backend proxy como Azure Function App.
#
# Variables de entorno requeridas (o como argumentos):
#   AZURE_FUNCTION_APP_NAME  -> nombre de la Function App en Azure
#   AZURE_RESOURCE_GROUP     -> nombre del Resource Group
#
# Uso:
#   $env:AZURE_FUNCTION_APP_NAME="fibot-backend"; $env:AZURE_RESOURCE_GROUP="rg-fibot"; npm run deploy:azure
#   -- O --
#   .\backend-proxy\deploy-azure.ps1 -FunctionAppName "fibot-backend" -ResourceGroup "rg-fibot"

param(
  [string]$FunctionAppName = $env:AZURE_FUNCTION_APP_NAME,
  [string]$ResourceGroup   = $env:AZURE_RESOURCE_GROUP
)

$ErrorActionPreference = 'Stop'

if (-not $FunctionAppName) {
  throw "Debes definir el nombre de la Function App. Usa -FunctionAppName o la variable de entorno AZURE_FUNCTION_APP_NAME."
}
if (-not $ResourceGroup) {
  throw "Debes definir el Resource Group. Usa -ResourceGroup o la variable de entorno AZURE_RESOURCE_GROUP."
}

$proxyDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$zipPath  = Join-Path $proxyDir 'azure-function.zip'

# 1. Empaquetar si el zip no existe
if (-not (Test-Path $zipPath)) {
  Write-Host "ZIP no encontrado. Empaquetando primero..."
  & "$proxyDir\package-azure.ps1"
}

# 2. Verificar que az CLI esta instalado
if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
  throw "Azure CLI (az) no encontrado. Instalalo desde: https://docs.microsoft.com/cli/azure/install-azure-cli"
}

# 3. Desplegar usando ZIP deploy
Write-Host "Desplegando '$zipPath' en Function App '$FunctionAppName' (Resource Group: '$ResourceGroup')..."
az functionapp deployment source config-zip `
  --resource-group $ResourceGroup `
  --name $FunctionAppName `
  --src $zipPath

if ($LASTEXITCODE -ne 0) {
  throw "El despliegue fallo. Revisa los errores de az CLI arriba."
}

Write-Host ""
Write-Host "Despliegue completado exitosamente."
Write-Host "URL: https://$FunctionAppName.azurewebsites.net/api/chat"
