# Script para crear y desplegar los 12 microservicios en Fly.io (Windows PowerShell)
# Requisitos:
#   1. Tener instalado flyctl: https://fly.io/docs/flyctl/install/
#   2. Haber iniciado sesión: flyctl auth login
#   3. Ejecutar desde la raíz del monorepo: .\scripts\deploy\fly-deploy-all.ps1

$ErrorActionPreference = "Stop"

$services = @(
  @{ Name = "api-gateway"; Config = "fly.toml" },
  @{ Name = "auth-service"; Config = "infrastructure/fly/fly.auth-service.toml" },
  @{ Name = "user-service"; Config = "infrastructure/fly/fly.user-service.toml" },
  @{ Name = "catalog-service"; Config = "infrastructure/fly/fly.catalog-service.toml" },
  @{ Name = "university-service"; Config = "infrastructure/fly/fly.university-service.toml" },
  @{ Name = "resource-service"; Config = "infrastructure/fly/fly.resource-service.toml" },
  @{ Name = "booking-service"; Config = "infrastructure/fly/fly.booking-service.toml" },
  @{ Name = "request-service"; Config = "infrastructure/fly/fly.request-service.toml" },
  @{ Name = "event-service"; Config = "infrastructure/fly/fly.event-service.toml" },
  @{ Name = "notification-service"; Config = "infrastructure/fly/fly.notification-service.toml" },
  @{ Name = "pqrs-service"; Config = "infrastructure/fly/fly.pqrs-service.toml" },
  @{ Name = "storage-service"; Config = "infrastructure/fly/fly.storage-service.toml" }
)

foreach ($svc in $services) {
  $appName = "uajs-smartcampus-$($svc.Name)"
  Write-Host "`n=== Verificando app $appName ===" -ForegroundColor Cyan
  flyctl apps show $appName 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Creando app $appName..." -ForegroundColor Yellow
    flyctl apps create $appName
  }

  Write-Host "Desplegando $($svc.Name) usando $($svc.Config)..." -ForegroundColor Green
  flyctl deploy -c $svc.Config .
}
