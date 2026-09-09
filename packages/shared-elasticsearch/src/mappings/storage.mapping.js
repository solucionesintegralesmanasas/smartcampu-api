module.exports = {
  settings: {
    number_of_shards: 1,
    number_of_replicas: 1,
  },
  mappings: {
    properties: {
      id: { type: 'integer' },
      uuid: { type: 'keyword' },
      nombre_original: { type: 'text', fields: { keyword: { type: 'keyword' } } },
      nombre_sistema: { type: 'keyword' },
      ruta_acceso: { type: 'keyword' },
      mime_type: { type: 'keyword' },
      peso_bytes: { type: 'long' },
      entidad_asociada: { type: 'keyword' },
      uuid_asociado: { type: 'keyword' },
      subido_por: { type: 'integer' },
      subido_por_nombre: { type: 'text', fields: { keyword: { type: 'keyword' } } },
      extension: { type: 'keyword' },
      carpeta: { type: 'keyword' },
      publico: { type: 'boolean' },
      activo: { type: 'boolean' },
      createdAt: { type: 'date' },
      updatedAt: { type: 'date' },
    },
  },
};
