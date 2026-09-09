const registerSearchTemplates = async (client) => {
  const templates = [
    {
      name: 'uajs_paginated_search',
      body: {
        query: {
          bool: {
            must: [{ match: { '{{query_field}}': '{{query_value}}' } }],
            filter: ['{{filters}}'],
          },
        },
        from: '{{from}}',
        size: '{{size}}',
        sort: [{ '{{sort_field}}': { order: '{{sort_order}}' } }],
        track_total_hits: true,
      },
    },
    {
      name: 'uajs_date_range_search',
      body: {
        query: {
          bool: {
            must: [{ range: { '{{date_field}}': { gte: '{{date_from}}', lte: '{{date_to}}' } } }],
            filter: ['{{filters}}'],
          },
        },
        from: '{{from}}',
        size: '{{size}}',
        sort: [{ '{{date_field}}': { order: 'desc' } }],
      },
    },
    {
      name: 'uajs_full_text_search',
      body: {
        query: {
          multi_match: {
            query: '{{query}}',
            fields: '{{fields}}',
            fuzziness: '{{fuzziness}}',
            operator: 'and',
          },
        },
        highlight: {
          fields: '{{fields}}',
          pre_tags: ['<em>'],
          post_tags: ['</em>'],
        },
        from: '{{from}}',
        size: '{{size}}',
      },
    },
  ];

  for (const template of templates) {
    try {
      await client.putScript({ id: template.name, body: template.body });
    } catch (e) {
      /* exists */
    }
  }
};

const useSearchTemplate = (client, templateName, params) => client.searchTemplate({
  body: { id: templateName, params },
});

module.exports = { registerSearchTemplates, useSearchTemplate };
