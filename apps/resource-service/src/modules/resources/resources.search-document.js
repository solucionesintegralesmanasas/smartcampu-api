/**
 * Construye el documento de búsqueda de un recurso según packages/shared-elasticsearch
 * (mapping resource.mapping.js).
 * @param {object} recurso - Recurso leído del repositorio.
 * @returns {object} Documento listo para indexar.
 */
const buildSearchDocument = (recurso) => {
  const ubicacion = [recurso.edificio, recurso.piso].filter(Boolean).join(' - ');
  const atributos = recurso.atributos || {};
  return {
    id: recurso.id,
    uuid: recurso.uuid,
    codigo: recurso.codigo,
    nombre: recurso.nombre,
    tipo: recurso.categoriaCodigo,
    estado: recurso.estadoCodigo,
    sede: recurso.campusNombre,
    ubicacion: ubicacion || null,
    capacidad: recurso.capacidad ?? null,
    descripcion: recurso.descripcion ?? null,
    equipamiento: Object.entries(atributos)
      .filter(([, value]) => value === true)
      .map(([key]) => key),
    activo: recurso.activo,
    createdAt: recurso.createdAt,
    updatedAt: recurso.updatedAt,
  };
};

module.exports = { buildSearchDocument };
