const { getPaginationMeta } = require('../../core/helpers/pagination.helper');

const toDto = (plantilla) => ({
  code: plantilla.code,
  name: plantilla.name,
  channel: plantilla.channel,
  subject: plantilla.subject,
  bodyText: plantilla.bodyText,
  bodyHtml: plantilla.bodyHtml,
  variables: plantilla.variables,
  isActive: plantilla.isActive,
  updatedAt: plantilla.updatedAt,
});

/**
 * Gestión de plantillas de notificación (listado y edición por código y canal).
 */
class PlantillasService {
  constructor(repository) {
    this.repository = repository;
  }

  async listar(filtros = {}) {
    const page = filtros.page || 1;
    const limit = filtros.limit || 20;
    const offset = (page - 1) * limit;

    const { rows, total } = await this.repository.findPaginated({ limit, offset });
    return { data: rows.map(toDto), meta: getPaginationMeta(page, limit, total) };
  }

  async actualizar(code, dto) {
    const plantilla = await this.repository.upsert({ code, ...dto });
    return toDto(plantilla);
  }
}

module.exports = PlantillasService;
