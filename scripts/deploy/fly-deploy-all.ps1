# Script para crear y desplegar los 12 microservicios en Fly.io (Windows PowerShell)
# Requisitos:
#   1. Tener instalado flyctl: https://fly.io/docs/flyctl/install/
#   2. Haber iniciado sesión: flyctl auth login
#   3. Ejecutar desde la raíz del monorepo: .\scripts\deploy\fly-deploy-all.ps1

$ErrorActionPreference = "Stop"

$services = @(
  @{ Name = "api-gateway"; App = "smartcampu-api"; Config = "fly.toml" },
  @{ Name = "auth-service"; App = "uajs-smartcampus-auth-service"; Config = "infrastructure/fly/fly.auth-service.toml" },
  @{ Name = "user-service"; App = "uajs-smartcampus-user-service"; Config = "infrastructure/fly/fly.user-service.toml" },
  @{ Name = "catalog-service"; App = "uajs-smartcampus-catalog-service"; Config = "infrastructure/fly/fly.catalog-service.toml" },
  @{ Name = "university-service"; App = "uajs-smartcampus-university-service"; Config = "infrastructure/fly/fly.university-service.toml" },
  @{ Name = "resource-service"; App = "uajs-smartcampus-resource-service"; Config = "infrastructure/fly/fly.resource-service.toml" },
  @{ Name = "booking-service"; App = "uajs-smartcampus-booking-service"; Config = "infrastructure/fly/fly.booking-service.toml" },
  @{ Name = "request-service"; App = "uajs-smartcampus-request-service"; Config = "infrastructure/fly/fly.request-service.toml" },
  @{ Name = "event-service"; App = "uajs-smartcampus-event-service"; Config = "infrastructure/fly/fly.event-service.toml" },
  @{ Name = "notification-service"; App = "uajs-smartcampus-notification-service"; Config = "infrastructure/fly/fly.notification-service.toml" },
  @{ Name = "pqrs-service"; App = "uajs-smartcampus-pqrs-service"; Config = "infrastructure/fly/fly.pqrs-service.toml" },
  @{ Name = "storage-service"; App = "uajs-smartcampus-storage-service"; Config = "infrastructure/fly/fly.storage-service.toml" }
)

foreach ($svc in $services) {
  $appName = $svc.App
  Write-Host "`n=== Verificando app $appName ===" -ForegroundColor Cyan
  flyctl apps show $appName 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Creando app $appName..." -ForegroundColor Yellow
    flyctl apps create $appName
  }

  Write-Host "Desplegando $($svc.Name) en $appName usando $($svc.Config)..." -ForegroundColor Green
  if ($svc.Name -eq "api-gateway") {
    # En despliegue distribuido (12 apps), api-gateway usa SERVICE_NAME=api-gateway y URLs .internal
    flyctl deploy -c $svc.Config --build-arg SERVICE_NAME=api-gateway `
      --env SERVICE_AUTH_URL=http://uajs-smartcampus-auth-service.internal:3001 `
      --env SERVICE_USER_URL=http://uajs-smartcampus-user-service.internal:3002 `
      --env SERVICE_CATALOG_URL=http://uajs-smartcampus-catalog-service.internal:3003 `
      --env SERVICE_UNIVERSITY_URL=http://uajs-smartcampus-university-service.internal:3004 `
      --env SERVICE_RESOURCE_URL=http://uajs-smartcampus-resource-service.internal:3005 `
      --env SERVICE_BOOKING_URL=http://uajs-smartcampus-booking-service.internal:3006 `
      --env SERVICE_REQUEST_URL=http://uajs-smartcampus-request-service.internal:3007 `
      --env SERVICE_EVENT_URL=http://uajs-smartcampus-event-service.internal:3008 `
      --env SERVICE_NOTIFICATION_URL=http://uajs-smartcampus-notification-service.internal:3009 `
      --env SERVICE_PQRS_URL=http://uajs-smartcampus-pqrs-service.internal:3010 `
      --env SERVICE_STORAGE_URL=http://uajs-smartcampus-storage-service.internal:3011 .
  } else {
    flyctl deploy -c $svc.Config .
  }
}
