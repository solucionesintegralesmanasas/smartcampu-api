const handleElasticsearchError = (error, context = '') => {
  const errorInfo = {
    context,
    message: error?.message || 'Unknown ES error',
    code: error?.meta?.statusCode || error?.code || 'UNKNOWN',
    type: error?.meta?.body?.error?.type || 'unknown_type',
  };

  if (error?.meta?.body?.error?.reason) {
    errorInfo.reason = error.meta.body.error.reason;
  }

  console.error('[Elasticsearch Error]', JSON.stringify(errorInfo));
  return errorInfo;
};

const isElasticsearchAvailable = async (client) => {
  try {
    await client.ping();
    return true;
  } catch {
    return false;
  }
};

const withFallback = async (esOperation, fallbackFn, context = '') => {
  try {
    return await esOperation();
  } catch (error) {
    handleElasticsearchError(error, context);
    if (typeof fallbackFn === 'function') {
      return fallbackFn();
    }
    return null;
  }
};

module.exports = { handleElasticsearchError, isElasticsearchAvailable, withFallback };
