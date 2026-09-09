module.exports = {
  settings: {
    number_of_shards: 1,
    number_of_replicas: 1,
  },
  mappings: {
    properties: {
      id: { type: 'integer' },
      uuid: { type: 'keyword' },
      codigo: { type: 'keyword' },
      nombre: { type: 'text', fields: { keyword: { type: 'keyword' } } },
      tipo: { type: 'keyword' },
      estado: { type: 'keyword' },
      sede: { type: 'keyword' },
      sede_id: { type: 'integer' },
      ubicacion: { type: 'text', fields: { keyword: { type: 'keyword' } } },
      capacidad: { type: 'integer' },
      descripcion: { type: 'text' },
      equipamiento: { type: 'keyword' },
      horario_disponible: { type: 'object', enabled: false },
      activo: { type: 'boolean' },
      createdAt: { type: 'date' },
      updatedAt: { type: 'date' },
    },
  },
};
