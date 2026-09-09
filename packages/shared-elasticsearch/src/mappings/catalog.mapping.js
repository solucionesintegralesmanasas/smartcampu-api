module.exports = {
  settings: {
    number_of_shards: 1,
    number_of_replicas: 1,
  },
  mappings: {
    properties: {
      id: { type: 'integer' },
      uuid: { type: 'keyword' },
      nombre: { type: 'text', fields: { keyword: { type: 'keyword' } } },
      codigo: { type: 'keyword' },
      tipo_catalogo: { type: 'keyword' },
      descripcion: { type: 'text' },
      dependencia_id: { type: 'integer' },
      dependencia_nombre: { type: 'text', fields: { keyword: { type: 'keyword' } } },
      padre_id: { type: 'integer' },
      nivel: { type: 'integer' },
      orden: { type: 'integer' },
      activo: { type: 'boolean' },
      metadata: { type: 'object', enabled: false },
      createdAt: { type: 'date' },
      updatedAt: { type: 'date' },
    },
  },
};
