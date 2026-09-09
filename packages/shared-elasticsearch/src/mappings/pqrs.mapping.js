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
      asunto: { type: 'text', fields: { keyword: { type: 'keyword' } } },
      descripcion: { type: 'text' },
      responsable: { type: 'text', fields: { keyword: { type: 'keyword' } } },
      fecha_radicacion: { type: 'date' },
      fecha_respuesta: { type: 'date' },
      fecha_cierre: { type: 'date' },
      calificacion: { type: 'integer' },
      comentarios: { type: 'text' },
      activo: { type: 'boolean' },
      createdAt: { type: 'date' },
      updatedAt: { type: 'date' },
    },
  },
};
