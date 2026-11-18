# ==========================================
# Dockerfile unificado para monorepo UAJS Smart Campus
# Modos de uso desde la raíz:
#   - Todos los servicios (default): docker build -t smartcampu-api .
#   - Servicio individual: docker build --build-arg SERVICE_NAME=auth-service --build-arg PORT=3001 --build-arg HEALTH_PATH=/healthz -t auth-service .
# ==========================================

ARG SERVICE_NAME=all
ARG PORT=3000
ARG HEALTH_PATH=/health

# ==========================================
# Etapa 1: Build (instalación de dependencias)
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Herramientas de compilación para módulos nativos (ej. bcrypt)
RUN apk add --no-cache python3 make g++

# Copiar manifests raíz, paquetes compartidos y los 12 microservicios del workspace
COPY package.json package-lock.json* ./
COPY packages/database-client/package.json ./packages/database-client/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY packages/shared-elasticsearch/package.json ./packages/shared-elasticsearch/
COPY apps/api-gateway/package.json ./apps/api-gateway/
COPY apps/auth-service/package.json ./apps/auth-service/
COPY apps/user-service/package.json ./apps/user-service/
COPY apps/catalog-service/package.json ./apps/catalog-service/
COPY apps/university-service/package.json ./apps/university-service/
COPY apps/resource-service/package.json ./apps/resource-service/
COPY apps/booking-service/package.json ./apps/booking-service/
COPY apps/request-service/package.json ./apps/request-service/
COPY apps/event-service/package.json ./apps/event-service/
COPY apps/notification-service/package.json ./apps/notification-service/
COPY apps/pqrs-service/package.json ./apps/pqrs-service/
COPY apps/storage-service/package.json ./apps/storage-service/

# Instalar dependencias de producción del monorepo
RUN npm ci --omit=dev && npm cache clean --force

# Copiar código fuente de paquetes compartidos, aplicaciones y scripts
COPY packages ./packages
COPY apps ./apps
COPY scripts ./scripts

# ==========================================
# Etapa 2: Runtime
# ==========================================
FROM node:20-alpine

ARG SERVICE_NAME=all
ARG PORT=3000
ARG HEALTH_PATH=/health

ENV NODE_ENV=production
ENV PORT=${PORT}
ENV SERVICE_NAME=${SERVICE_NAME}

WORKDIR /app

# Crear usuario no-root y directorio de uploads (requerido por storage-service)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    mkdir -p /uploads && \
    chown -R nodejs:nodejs /uploads

COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/packages ./packages
COPY --from=builder --chown=nodejs:nodejs /app/apps ./apps
COPY --from=builder --chown=nodejs:nodejs /app/scripts ./scripts

USER nodejs

EXPOSE ${PORT}

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:${PORT}${HEALTH_PATH} || exit 1

CMD ["node", "/app/scripts/start-all.js"]
