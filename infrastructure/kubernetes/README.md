# Kubernetes — UAJS Smart Campus

Manifiestos para desplegar los 12 microservicios (además de MySQL, Redis y
Elasticsearch como Deployments de un solo pod, replicando el nivel de
`infrastructure/docker/docker-compose.yml` — no son StatefulSets ni clústeres
de alta disponibilidad). Pensado como el equivalente en Kubernetes de ese
mismo docker-compose, no como una topología de producción distinta.

## Orden de aplicación

```bash
kubectl apply -f namespace.yaml
kubectl apply -f configmap.yaml

# Copiar la plantilla, reemplazar TODOS los valores CHANGE_ME y NO versionar
# el resultado.
cp secrets.yaml.example secrets.yaml
kubectl apply -f secrets.yaml

# Las migraciones se montan como ConfigMap en /docker-entrypoint-initdb.d
# del contenedor de MySQL (igual que init-databases.sh en docker-compose).
kubectl create configmap mysql-migrations \
  --from-file=../../scripts/migrations \
  -n uajs-smart-campus

kubectl apply -f infra/mysql.yaml
kubectl apply -f infra/redis.yaml
kubectl apply -f infra/elasticsearch.yaml

kubectl apply -f services/
kubectl apply -f ingress.yaml
```

## Imagen de los microservicios

Los 12 `Deployment` de `services/` usan la MISMA imagen (`uajs-base:latest`,
construida desde `infrastructure/docker/Dockerfile.base`, igual que
docker-compose) y solo cambian el `command` para arrancar el `server.js` de
cada servicio. Antes de aplicar `services/`, construir y publicar esa imagen
en el registro que use el clúster:

```bash
docker build -f infrastructure/docker/Dockerfile.base -t <tu-registro>/uajs-base:latest .
docker push <tu-registro>/uajs-base:latest
```

y reemplazar `image: uajs-base:latest` por `<tu-registro>/uajs-base:latest`
en cada archivo de `services/`.

## Notas

- **storage-service** usa disco local (no S3 — ver
  `apps/storage-service/src/config/storage.js`), por eso su `Deployment`
  tiene `replicas: 1` y un PVC `ReadWriteOnce`. Con más de una réplica, cada
  pod solo vería los archivos que él mismo escribió.
- El único punto de entrada externo es `api-gateway` vía `ingress.yaml`; el
  resto de los `Service` son `ClusterIP` (solo alcanzables dentro del
  namespace), igual que en docker-compose donde solo el gateway está pensado
  para tráfico externo.
- `configmap.yaml` incluye las URLs internas `SERVICE_*_URL` usando el
  nombre del `Service` de Kubernetes como host (ej. `http://auth-service:3001`),
  resuelto vía DNS interno del clúster — no requiere configuración adicional
  siempre que todo corra en el namespace `uajs-smart-campus`.
- **No implementado aquí** (fuera de alcance de este plan, ver
  `docs/uajs-smart-campus-16-prompts-de-generación-v2-1-enterprise-grade-con-elasticsearch.md`
  para la topología de referencia si se necesita en el futuro): HorizontalPodAutoscaler,
  NetworkPolicy, réplicas de MySQL/Elasticsearch, backups automatizados.
