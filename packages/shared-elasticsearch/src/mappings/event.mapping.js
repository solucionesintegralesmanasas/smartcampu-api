module.exports = {
  settings: {
    number_of_shards: 1,
    number_of_replicas: 1,
    analysis: {
      analyzer: {
        event_text_analyzer: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'stop', 'asciifolding'],
        },
      },
    },
  },
  mappings: {
    properties: {
      id: { type: 'integer' },
      uuid: { type: 'keyword' },
      nombre: {
        type: 'text',
        analyzer: 'event_text_analyzer',
        fields: { keyword: { type: 'keyword' } },
      },
      descripcion: { type: 'text', analyzer: 'event_text_analyzer' },
      tipo: { type: 'keyword' },
      estado: { type: 'keyword' },
      fecha_evento: { type: 'date' },
      hora_evento: { type: 'keyword' },
      sede: { type: 'keyword' },
      lugar: { type: 'text', fields: { keyword: { type: 'keyword' } } },
      cupo_maximo: { type: 'integer' },
      cupo_disponible: { type: 'integer' },
      organizador_id: { type: 'integer' },
      tags: { type: 'keyword' },
      activo: { type: 'boolean' },
      createdAt: { type: 'date' },
      updatedAt: { type: 'date' },
    },
  },
};
