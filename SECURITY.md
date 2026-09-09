# Politica de Seguridad — UAJS Smart Campus

## Autenticacion

- JWT con HS256, minimo 64 caracteres para JWT_SECRET
- Tokens de servicio inter-service con rotacion periodica
- Rate limiting por IP y usuario

## Datos

- Cifrado en transito (TLS 1.2+)
- Cifrado en reposo para datos sensiveles
- Backup automatico diario
- Retencion de logs: 90 dias

## Infraestructura

- Containers como usuario no-root
- Health checks en todos los servicios
- Circuit Breaker para dependencias criticas
- Secrets en variables de entorno, nunca en codigo

## Dependencias

- Escaneo automatico de vulnerabilidades (npm audit)
- Actualizaciones de seguridad mensuales
- Licencias permitidas: MIT, ISC, BSD

## Monitoreo

- Logs estructurados a Elasticsearch
- Metricas Prometheus
- Alertas por umbral de errores
- SLOs: 99.9% disponibilidad
