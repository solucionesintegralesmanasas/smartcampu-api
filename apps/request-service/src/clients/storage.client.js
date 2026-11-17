const { env } = require('../config/env');
const logger = require('../config/logger');

/**
 * Cliente HTTP hacia storage-service. `GET /archivos/:id` de storage-service
 * exige ser el dueño del archivo o admin/staff (requireAuth, no
 * requireTrustedService) — así que esta llamada reenvía la identidad del
 * usuario que está adjuntando el archivo, no solo el secreto de servicio.
 * Esto hace cumplir exactamente la regla que queremos: nadie puede
 * enganchar a su solicitud un archivo que no es suyo.
 */
async function fetchWithTimeout(url, requester, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'X-Service-Token': env.SERVICE_AUTH_TOKEN,
        'X-User-Id': String(requester.id),
        'X-User-Uuid': requester.uuid,
        'X-User-Roles': requester.roles.join(','),
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Obtiene metadata de un archivo por id numérico interno de storage-service,
 * en nombre del usuario `requester` (debe ser el dueño del archivo o
 * admin/staff). Devuelve null si no existe, no le pertenece, o si el
 * servicio no responde — nunca se confía en el tamaño/tipo MIME que el
 * cliente afirme al vincular un adjunto, se obtienen siempre de storage-service.
 */
async function getFile(fileId, requester) {
  try {
    const response = await fetchWithTimeout(
      `${env.SERVICE_STORAGE_URL}/api/v1/storage/archivos/${fileId}`,
      requester,
    );
    if (!response.ok) return null;
    const body = await response.json();
    return body.data ?? null;
  } catch (error) {
    logger.warn('No se pudo consultar storage-service (getFile)', {
      fileId,
      error: error.message,
    });
    return null;
  }
}

module.exports = { getFile };
