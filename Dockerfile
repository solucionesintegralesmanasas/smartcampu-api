# ==========================================
# Dockerfile unificado para monorepo UAJS Smart Campus
# Uso desde la raíz:
#   docker build --build-arg SERVICE_NAME=api-gateway --build-arg PORT=3000 -t api-gateway .
# ==========================================

ARG SERVICE_NAME=api-gateway
ARG PORT=3000
ARG HEALTH_PATH=/health

# ==========================================
# Etapa 1: Build (instalación de dependencias)
# ==========================================
FROM node:20-alpine AS builder

ARG SERVICE_NAME

WORKDIR /app

# Herramientas de compilación para módulos nativos (ej. bcrypt)
RUN apk add --no-cache python3 make g++

# Copiar manifests raíz y paquetes compartidos
COPY package.json package-lock.json* ./
COPY packages/database-client/package.json ./packages/database-client/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY packages/shared-elasticsearch/package.json ./packages/shared-elasticsearch/
COPY apps/${SERVICE_NAME}/package.json ./apps/${SERVICE_NAME}/

# Instalar dependencias de producción del monorepo
RUN npm ci --omit=dev && npm cache clean --force

# Copiar código fuente de paquetes compartidos y del servicio objetivo
COPY packages ./packages
COPY apps/${SERVICE_NAME} ./apps/${SERVICE_NAME}

# ==========================================
# Etapa 2: Runtime
# ==========================================
FROM node:20-alpine

ARG SERVICE_NAME
ARG PORT
ARG HEALTH_PATH

ENV NODE_ENV=production
ENV PORT=${PORT}

WORKDIR /app

# Crear usuario no-root y directorio de uploads (requerido por storage-service)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    mkdir -p /uploads && \
    chown -R nodejs:nodejs /uploads

COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/packages ./packages
COPY --from=builder --chown=nodejs:nodejs /app/apps/${SERVICE_NAME} ./apps/${SERVICE_NAME}

WORKDIR /app/apps/${SERVICE_NAME}

USER nodejs

EXPOSE ${PORT}

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:${PORT}${HEALTH_PATH} || exit 1

CMD ["node", "src/server.js"]
