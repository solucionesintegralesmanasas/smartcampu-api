module.exports = {
  settings: {
    number_of_shards: 1,
    number_of_replicas: 1,
    analysis: {
      analyzer: {
        person_name_analyzer: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'asciifolding'],
        },
      },
    },
  },
  mappings: {
    properties: {
      id: { type: 'integer' },
      uuid: { type: 'keyword' },
      tipo: { type: 'keyword' },
      numero_documento: { type: 'keyword' },
      primer_nombre: {
        type: 'text',
        analyzer: 'person_name_analyzer',
        fields: { keyword: { type: 'keyword' } },
      },
      segundo_nombre: {
        type: 'text',
        analyzer: 'person_name_analyzer',
        fields: { keyword: { type: 'keyword' } },
      },
      primer_apellido: {
        type: 'text',
        analyzer: 'person_name_analyzer',
        fields: { keyword: { type: 'keyword' } },
      },
      segundo_apellido: {
        type: 'text',
        analyzer: 'person_name_analyzer',
        fields: { keyword: { type: 'keyword' } },
      },
      email: { type: 'keyword' },
      telefono: { type: 'keyword' },
      codigo_estudiantil: { type: 'keyword' },
      codigo_docente: { type: 'keyword' },
      programa: { type: 'text', fields: { keyword: { type: 'keyword' } } },
      facultad: { type: 'text', fields: { keyword: { type: 'keyword' } } },
      departamento: { type: 'text', fields: { keyword: { type: 'keyword' } } },
      semestre: { type: 'integer' },
      estado: { type: 'keyword' },
      activo: { type: 'boolean' },
      createdAt: { type: 'date' },
      updatedAt: { type: 'date' },
    },
  },
};
