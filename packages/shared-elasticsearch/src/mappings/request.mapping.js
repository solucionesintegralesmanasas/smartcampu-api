module.exports = {
  settings: {
    number_of_shards: 1,
    number_of_replicas: 1,
  },
  mappings: {
    properties: {
      id: { type: 'integer' },
      uuid: { type: 'keyword' },
      numero_solicitud: { type: 'keyword' },
      id_usuario: { type: 'integer' },
      usuario_nombre: { type: 'text', fields: { keyword: { type: 'keyword' } } },
      tipo: { type: 'keyword' },
      estado: { type: 'keyword' },
      prioridad: { type: 'keyword' },
      titulo: { type: 'text', fields: { keyword: { type: 'keyword' } } },
      descripcion: { type: 'text' },
      id_usuario_asignado: { type: 'integer' },
      asignado_nombre: { type: 'text', fields: { keyword: { type: 'keyword' } } },
      observaciones: { type: 'text' },
      fecha_solicitud: { type: 'date' },
      fecha_resolucion: { type: 'date' },
      metadata: { type: 'object', enabled: false },
      activo: { type: 'boolean' },
      createdAt: { type: 'date' },
      updatedAt: { type: 'date' },
    },
  },
};
