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
      id_recurso: { type: 'integer' },
      recurso_nombre: { type: 'text', fields: { keyword: { type: 'keyword' } } },
      recurso_tipo: { type: 'keyword' },
      tipo: { type: 'keyword' },
      estado: { type: 'keyword' },
      fecha_reserva: { type: 'date' },
      hora_inicio: { type: 'keyword' },
      hora_fin: { type: 'keyword' },
      observaciones: { type: 'text' },
      motivo: { type: 'text' },
      aprobado_por: { type: 'integer' },
      activo: { type: 'boolean' },
      createdAt: { type: 'date' },
      updatedAt: { type: 'date' },
    },
  },
};
