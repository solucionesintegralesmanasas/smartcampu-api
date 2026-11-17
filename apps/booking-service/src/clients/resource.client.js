const { env } = require('../config/env');
const logger = require('../config/logger');

/**
 * Cliente HTTP hacia resource-service. Se llama con el mismo
 * X-Service-Token que valida identity.middleware en el resto de servicios —
 * resource-service acepta esta ruta con requireTrustedService, sin exigir
 * identidad de usuario final adjunta.
 */
async function fetchWithTimeout(url, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { 'X-Service-Token': env.SERVICE_AUTH_TOKEN },
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Obtiene el recurso por id. Devuelve null si no existe o si
 * resource-service no responde (se trata como "no se pudo confirmar", no
 * como "existe").
 */
async function getResource(resourceId) {
  try {
    const response = await fetchWithTimeout(
      `${env.SERVICE_RESOURCE_URL}/api/v1/resources/recursos/${resourceId}`,
    );
    if (!response.ok) return null;
    const body = await response.json();
    return body.data ?? null;
  } catch (error) {
    logger.warn('No se pudo consultar resource-service (getResource)', {
      resourceId,
      error: error.message,
    });
    return null;
  }
}

/**
 * Consulta disponibilidad OPERATIVA (estado + horario + bloqueos) del
 * recurso para la ventana solicitada. Si resource-service no responde, se
 * asume no disponible: es más seguro rechazar una reserva que confirmarla
 * sin poder verificar el horario real del recurso.
 */
async function checkResourceAvailability(resourceId, {
  date, startTime, endTime,
}) {
  try {
    const params = new URLSearchParams({ date, startTime, endTime });
    const path = `/api/v1/resources/recursos/${resourceId}/disponibilidad`;
    const response = await fetchWithTimeout(`${env.SERVICE_RESOURCE_URL}${path}?${params}`);
    if (!response.ok) {
      return { available: false, reason: 'resource_service_error' };
    }
    const body = await response.json();
    return body.data ?? { available: false, reason: 'resource_service_error' };
  } catch (error) {
    logger.warn('No se pudo consultar resource-service (checkResourceAvailability)', {
      resourceId,
      error: error.message,
    });
    return { available: false, reason: 'resource_service_unreachable' };
  }
}

module.exports = { getResource, checkResourceAvailability };
