module.exports = {
  settings: {
    number_of_shards: 1,
    number_of_replicas: 1,
    analysis: {
      analyzer: {
        email_analyzer: {
          type: 'custom',
          tokenizer: 'uax_url_email',
          filter: ['lowercase', 'stop'],
        },
      },
    },
  },
  mappings: {
    properties: {
      id: { type: 'integer' },
      uuid: { type: 'keyword' },
      correo: { type: 'keyword', analyzer: 'email_analyzer', search_as_analyzer: true },
      estado: { type: 'keyword' },
      id_tercero: { type: 'integer' },
      roles: { type: 'keyword' },
      permisos: { type: 'keyword' },
      primer_nombre: { type: 'text', fields: { keyword: { type: 'keyword' } } },
      primer_apellido: { type: 'text', fields: { keyword: { type: 'keyword' } } },
      numero_documento: { type: 'keyword' },
      telefono: { type: 'keyword' },
      activo: { type: 'boolean' },
      ultimo_acceso: { type: 'date' },
      createdAt: { type: 'date' },
      updatedAt: { type: 'date' },
    },
  },
};
