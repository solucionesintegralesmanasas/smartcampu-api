const indexDocument = async (client, index, id, body) => {
  await client.index({
    index,
    id,
    body,
    refresh: true,
  });
};

const updateDocument = async (client, index, id, body) => {
  await client.update({
    index,
    id,
    body: { doc: body },
  });
};

const deleteDocument = async (client, index, id) => {
  await client.delete({
    index,
    id,
  });
};

const bulkIndex = async (client, index, documents) => {
  if (!documents.length) return;

  const body = documents.flatMap((doc) => [
    { index: { _index: index, _id: doc.uuid || doc.id } },
    doc,
  ]);

  const result = await client.bulk({ body, refresh: false });
  return result;
};

const searchWithHighlight = async (client, index, {
  query, fields, page = 1, size = 20,
}) => {
  const result = await client.search({
    index,
    body: {
      query: {
        multi_match: {
          query,
          fields,
        },
      },
      highlight: {
        fields: fields.reduce((acc, field) => {
          acc[field] = {};
          return acc;
        }, {}),
      },
      from: (page - 1) * size,
      size,
    },
  });
  return result;
};

module.exports = {
  indexDocument,
  updateDocument,
  deleteDocument,
  bulkIndex,
  searchWithHighlight,
};
