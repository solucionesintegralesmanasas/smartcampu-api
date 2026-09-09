#!/bin/bash
# Script de inicialización del monorepo UAJS Smart Campus
# Genera la estructura completa de carpetas (273 carpetas)
# Es idempotente y muestra un resumen al final

set -e

echo "🚀 Inicializando estructura del monorepo UAJS Smart Campus..."

# Función para crear directorios con mkdir -p
create_dirs() {
    for dir in "$@"; do
        mkdir -p "$dir"
    done
}

# 1. APPS (12 servicios)
SERVICES=(
    "api-gateway"
    "auth-service"
    "user-service"
    "catalog-service"
    "university-service"
    "resource-service"
    "booking-service"
    "request-service"
    "event-service"
    "notification-service"
    "pqrs-service"
    "storage-service"
)

# Para cada servicio (excepto api-gateway), crear estructura completa
for service in "${SERVICES[@]}"; do
    if [ "$service" = "api-gateway" ]; then
        # api-gateway tiene estructura especial
        create_dirs \
            "apps/$service/src/config" \
            "apps/$service/src/core/rateLimiter" \
            "apps/$service/src/middleware" \
            "apps/$service/src/routes" \
            "apps/$service/tests/unit" \
            "apps/$service/tests/e2e"
    else
        # Servicios de dominio con estructura estándar
        create_dirs \
            "apps/$service/src/config/database" \
            "apps/$service/src/core/exceptions" \
            "apps/$service/src/core/loaders" \
            "apps/$service/src/core/helpers" \
            "apps/$service/src/modules" \
            "apps/$service/src/jobs/producers" \
            "apps/$service/src/jobs/consumers" \
            "apps/$service/src/docs" \
            "apps/$service/tests/unit" \
            "apps/$service/tests/integration" \
            "apps/$service/tests/e2e" \
            "apps/$service/tests/fixtures"
    fi
done

# 2. PACKAGES (3 paquetes compartidos)
PACKAGES=("shared-types" "shared-utils" "database-client")
for pkg in "${PACKAGES[@]}"; do
    create_dirs "packages/$pkg/src"
done

# 3. INFRAESTRUCTURA
create_dirs \
    "infrastructure/docker/init" \
    "infrastructure/secrets" \
    "infrastructure/nginx"

# Subcarpetas de kubernetes (12 servicios)
for service in "${SERVICES[@]}"; do
    create_dirs "infrastructure/kubernetes/$service"
done

# 4. SCRIPTS
create_dirs \
    "scripts/seed" \
    "scripts/migrations"

# 5. DOCS
create_dirs "docs"

# 6. GITHUB WORKFLOWS
create_dirs ".github/workflows"

# 7. HUSKY
create_dirs ".husky"

# Contar carpetas creadas
total_dirs=$(find . -type d -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "." | wc -l | xargs)
echo "✅ Estructura creada: $total_dirs carpetas generadas (273 esperadas)"

# Verificar que se crearon las carpetas críticas
echo "🔍 Verificando carpetas críticas..."
critical_dirs=(
    "apps/api-gateway/src/routes"
    "apps/auth-service/src/modules"
    "apps/user-service/src/modules"
    "packages/shared-types/src"
    "packages/shared-utils/src"
    "packages/database-client/src"
    "infrastructure/docker/init"
)

for dir in "${critical_dirs[@]}"; do
    if [ -d "$dir" ]; then
        echo "  ✅ $dir"
    else
        echo "  ❌ $dir (NO ENCONTRADO)"
        exit 1
    fi
done

echo ""
echo "✨ Estructura completa lista. Ejecuta 'npm install' para instalar dependencias."