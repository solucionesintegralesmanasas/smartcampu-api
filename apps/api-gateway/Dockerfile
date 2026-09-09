# ==========================================
# Etapa 1: Build
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar package.json raíz y lockfile (registran todos los workspaces del monorepo)
COPY package.json package-lock.json* ./

# Copiar manifests de TODOS los workspaces que referencia el lockfile
# (apps/* y packages/*), para que `npm ci` pueda resolver el árbol completo.
COPY apps/api-gateway/package.json ./apps/api-gateway/
COPY packages/database-client/package.json ./packages/database-client/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY packages/shared-elasticsearch/package.json ./packages/shared-elasticsearch/

# Instalar dependencias (incluyendo workspaces). --ignore-scripts evita
# ejecutar binarios de dependencias durante la instalación.
RUN npm ci --ignore-scripts

# Copiar código fuente del gateway y los paquetes que necesita en runtime
COPY apps/api-gateway ./apps/api-gateway
COPY packages/database-client ./packages/database-client
COPY packages/shared-types ./packages/shared-types
COPY packages/shared-utils ./packages/shared-utils
COPY packages/shared-elasticsearch ./packages/shared-elasticsearch

# ==========================================
# Etapa 2: Runtime
# ==========================================
FROM node:20-alpine

WORKDIR /app

# Crear usuario no-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copiar dependencias y código desde builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/packages/database-client ./packages/database-client
COPY --from=builder --chown=nodejs:nodejs /app/packages/shared-types ./packages/shared-types
COPY --from=builder --chown=nodejs:nodejs /app/packages/shared-utils ./packages/shared-utils
COPY --from=builder --chown=nodejs:nodejs /app/packages/shared-elasticsearch ./packages/shared-elasticsearch
COPY --from=builder --chown=nodejs:nodejs /app/apps/api-gateway ./apps/api-gateway

WORKDIR /app/apps/api-gateway

# Cambiar a usuario no-root
USER nodejs

EXPOSE 3000

# Healthcheck nativo de Docker
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "src/server.js"]
