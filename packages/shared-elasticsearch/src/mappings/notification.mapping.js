module.exports = {
  settings: {
    number_of_shards: 1,
    number_of_replicas: 1,
  },
  mappings: {
    properties: {
      id: { type: 'integer' },
      uuid: { type: 'keyword' },
      id_usuario: { type: 'integer' },
      usuario_nombre: { type: 'text', fields: { keyword: { type: 'keyword' } } },
      tipo: { type: 'keyword' },
      estado: { type: 'keyword' },
      titulo: { type: 'text', fields: { keyword: { type: 'keyword' } } },
      mensaje: { type: 'text' },
      entidad_referencia: { type: 'keyword' },
      uuid_referencia: { type: 'keyword' },
      canal: { type: 'keyword' },
      intentos_envio: { type: 'integer' },
      fecha_envio: { type: 'date' },
      fecha_lectura: { type: 'date' },
      metadata: { type: 'object', enabled: false },
      activo: { type: 'boolean' },
      createdAt: { type: 'date' },
      updatedAt: { type: 'date' },
    },
  },
};
