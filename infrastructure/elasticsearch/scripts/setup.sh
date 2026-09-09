#!/bin/bash
set -euo pipefail

echo "Configurando Elasticsearch para UAJS Smart Campus..."

mkdir -p infrastructure/elasticsearch/certs

if [ ! -f "infrastructure/elasticsearch/certs/ca.crt" ]; then
  echo "Generando certificados auto-firmados..."
  openssl genrsa -out infrastructure/elasticsearch/certs/ca.key 2048
  openssl req -new -x509 -days 3650 -key infrastructure/elasticsearch/certs/ca.key \
    -out infrastructure/elasticsearch/certs/ca.crt -subj "/CN=UAJS CA"
  openssl genrsa -out infrastructure/elasticsearch/certs/elasticsearch.key 2048
  openssl req -new -key infrastructure/elasticsearch/certs/elasticsearch.key \
    -out infrastructure/elasticsearch/certs/elasticsearch.csr -subj "/CN=elasticsearch"
  openssl x509 -req -days 3650 -CA infrastructure/elasticsearch/certs/ca.crt \
    -CAkey infrastructure/elasticsearch/certs/ca.key \
    -in infrastructure/elasticsearch/certs/elasticsearch.csr \
    -out infrastructure/elasticsearch/certs/elasticsearch.crt
  echo "Certificados generados"
fi

chmod 600 infrastructure/elasticsearch/certs/*.key
chmod 644 infrastructure/elasticsearch/certs/*.crt

echo "Esperando a que Elasticsearch este listo..."
for i in $(seq 1 30); do
  if curl -k -u elastic:${ELASTICSEARCH_PASSWORD:-changeme} https://localhost:9200 >/dev/null 2>&1; then
    echo "Elasticsearch listo"
    break
  fi
  sleep 10
done

echo "Configurando mapeos..."
node scripts/elasticsearch/setup.js

echo "Configuracion completada"
