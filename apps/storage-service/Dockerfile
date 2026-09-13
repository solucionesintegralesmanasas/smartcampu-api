FROM node:20-alpine

# Instalar dependencias del sistema para bcrypt y otros módulos nativos
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copiar archivos de package.json del monorepo
COPY package*.json ./
COPY apps/storage-service/package*.json ./apps/storage-service/
COPY packages/*/package*.json ./packages/*/

# Instalar dependencias
RUN npm ci --workspaces --include-workspace-root

# Copiar código fuente
COPY apps/storage-service ./apps/storage-service
COPY packages ./packages

# Crear directorio de uploads
RUN mkdir -p /uploads && chown -R node:node /uploads

# Cambiar a usuario no root
USER node

WORKDIR /app/apps/storage-service

EXPOSE 3011

CMD ["npm", "run", "dev"]