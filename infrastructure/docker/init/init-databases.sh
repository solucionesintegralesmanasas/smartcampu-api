#!/bin/bash
# ============================================================
# init-databases.sh — Inicialización de bases de datos
# ------------------------------------------------------------
# Crea las bases de datos por microservicio (database-per-service)
# ejecutando cada migración SQL versionada ms-*_001_init.sql.
# Cada script es autónomo: contiene su propio CREATE DATABASE
# IF NOT EXISTS + USE <db>.
#
# Se ejecuta automáticamente en el primer arranque del contenedor
# MySQL (via /docker-entrypoint-initdb.d). Es idempotente.
# ============================================================

set -e

MIGRATIONS_DIR="/scripts/migrations"

echo "==> Inicializando bases de datos por microservicio..."

for migration in "${MIGRATIONS_DIR}"/ms-*_001_init.sql; do
  [ -f "${migration}" ] || continue
  echo "==> Aplicando migración: $(basename "${migration}")"
  mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" < "${migration}"
  echo "==> ✓ $(basename "${migration}") aplicada"
done

# ============================================================
# Otorgar privilegios del usuario de aplicación sobre cada base
# creada por los microservicios (database-per-service).
# El usuario por defecto solo recibe acceso a la base definida
# en MYSQL_DATABASE (uajs_smart_campus); aquí se habilitan
# también las bases de auth, catalog y el resto de servicios.
# ============================================================
echo "==> Otorgando privilegios a ${MYSQL_USER} sobre las bases de datos..."

for database in $(mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" -N -e "SHOW DATABASES" | grep '^uajs_' | grep -v '^uajs_smart_campus$'); do
  echo "==> GRANT ALL PRIVILEGES ON ${database}.* TO ${MYSQL_USER}"
  mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" -e "GRANT ALL PRIVILEGES ON \`${database}\`.* TO '${MYSQL_USER}'@'%'"
done

mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" -e "FLUSH PRIVILEGES"

echo "==> Inicialización de bases de datos completada."
