const { env } = require('../../config/env');
const { AppError, NotFoundError } = require('../../core/exceptions');

const MENSAJE_NO_DISPONIBLE = 'No se pudo verificar la disponibilidad del recurso. Intente más tarde';

/**
 * Cliente REST de resource-service para consultar la disponibilidad de un recurso.
 *
 * Contrato esperado: GET /api/v1/recursos/:recursoUuid/disponibilidad?fecha&horaInicio&horaFin
 * responde { success, data: { disponible: boolean, motivo?: string, recurso?: { uuid, nombre } } }.
 */
class ResourceAvailabilityClient {
  constructor({
    baseUrl = env.SERVICE_RESOURCE_URL,
    serviceToken = env.SERVICE_AUTH_TOKEN,
    timeoutMs = env.RESOURCE_TIMEOUT_MS,
    fetchImpl = globalThis.fetch,
  } = {}) {
    this.baseUrl = baseUrl;
    this.serviceToken = serviceToken;
    this.timeoutMs = timeoutMs;
    this.fetchImpl = fetchImpl;
  }

  /**
   * @param {object} params
   * @param {string} params.recursoUuid
   * @param {string} params.fecha - YYYY-MM-DD
   * @param {string} params.horaInicio - HH:mm:ss
   * @param {string} params.horaFin - HH:mm:ss
   * @param {string} [params.tokenUsuario] - Token del usuario que solicita la reserva.
   * @returns {Promise<{disponible: boolean, motivo: string|null, recursoNombre: string|null}>}
   */
  async verificarDisponibilidad({ recursoUuid, fecha, horaInicio, horaFin, tokenUsuario }) {
    const query = new URLSearchParams({ fecha, horaInicio, horaFin });
    const url = `${this.baseUrl}/api/v1/recursos/${recursoUuid}/disponibilidad?${query}`;

    const headers = {
      Accept: 'application/json',
      Authorization: `Bearer ${this.serviceToken}`,
    };
    if (tokenUsuario) {
      headers['X-User-Authorization'] = `Bearer ${tokenUsuario}`;
    }

    let respuesta;
    try {
      respuesta = await this.fetchImpl(url, {
        headers,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new AppError(MENSAJE_NO_DISPONIBLE, 503);
    }

    if (respuesta.status === 404) {
      throw new NotFoundError('El recurso indicado no existe');
    }
    if (!respuesta.ok) {
      throw new AppError(MENSAJE_NO_DISPONIBLE, 503);
    }

    const cuerpo = await respuesta.json().catch(() => null);
    const datos = cuerpo?.data ?? cuerpo;
    if (!datos || typeof datos.disponible !== 'boolean') {
      throw new AppError(MENSAJE_NO_DISPONIBLE, 503);
    }

    return {
      disponible: datos.disponible,
      motivo: datos.motivo || null,
      recursoNombre: datos.recurso?.nombre || null,
    };
  }
}

module.exports = ResourceAvailabilityClient;
