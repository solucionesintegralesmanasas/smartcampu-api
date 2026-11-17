const toIso = (valor) => (valor ? new Date(valor).toISOString() : null);

/**
 * Convierte una fila de evento (con joins de categoría y estado) al contrato de respuesta.
 * El id interno no se expone.
 * @param {Object} row
 * @returns {Object}
 */
const toEventoResponse = (row) => ({
  uuid: row.uuid,
  titulo: row.titulo,
  descripcion: row.descripcion ?? null,
  lugar: row.lugar ?? null,
  fechaInicio: toIso(row.fechaInicio),
  fechaFin: toIso(row.fechaFin),
  capacidadMaxima: row.capacidadMaxima ?? null,
  costo: Number(row.costo),
  requiereInscripcion: Boolean(row.requiereInscripcion),
  fechaLimiteInscripcion: toIso(row.fechaLimiteInscripcion),
  portadaUuid: row.portadaUuid ?? null,
  estado: row.estado,
  categoria: {
    uuid: row.categoriaUuid,
    codigo: row.categoriaCodigo,
    nombre: row.categoriaNombre,
    colorHex: row.categoriaColor ?? null,
    icono: row.categoriaIcono ?? null,
  },
  organizador: { uuid: row.organizadorUuid, nombre: row.organizadorNombre },
  sede: { uuid: row.sedeUuid, nombre: row.sedeNombre },
  createdAt: toIso(row.createdAt),
  updatedAt: toIso(row.updatedAt),
});

module.exports = { toEventoResponse, toIso };
