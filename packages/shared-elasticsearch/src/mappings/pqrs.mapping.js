module.exports = {
  settings: {
    number_of_shards: 1,
    number_of_replicas: 1,
  },
  mappings: {
    properties: {
      id: { type: 'integer' },
      uuid: { type: 'keyword' },
      ticket_number: { type: 'keyword' },
      tipo_codigo: { type: 'keyword' },
      estado_codigo: { type: 'keyword' },
      asunto: { type: 'text', fields: { keyword: { type: 'keyword' } } },
      descripcion: { type: 'text' },
      requester_uuid: { type: 'keyword' },
      requester_name: { type: 'text', fields: { keyword: { type: 'keyword' } } },
      assignee_uuid: { type: 'keyword' },
      assignee_name: { type: 'text', fields: { keyword: { type: 'keyword' } } },
      fecha_radicacion: { type: 'date' },
      fecha_respuesta: { type: 'date' },
      fecha_cierre: { type: 'date' },
      calificacion: { type: 'integer' },
      activo: { type: 'boolean' },
      createdAt: { type: 'date' },
      updatedAt: { type: 'date' },
    },
  },
};
