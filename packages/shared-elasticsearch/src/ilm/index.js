const createILMPolicy = async (
  client,
  {
    name, hotPhase, warmPhase, coldPhase, deletePhase,
  } = {},
) => {
  const policy = {};
  if (hotPhase) policy.hot = hotPhase;
  if (warmPhase) policy.warm = warmPhase;
  if (coldPhase) policy.cold = coldPhase;
  if (deletePhase) policy.delete = deletePhase;

  try {
    await client.ilm.putLifecycle({ name, policy });
    return { created: true, name };
  } catch (error) {
    if (error.statusCode === 400) return { created: false, name };
    throw error;
  }
};

const createIndexWithILM = async (client, index, mapping, ilmPolicyName) => {
  let policyExists = false;
  try {
    await client.ilm.getLifecycle({ name: ilmPolicyName });
    policyExists = true;
  } catch {
    policyExists = false;
  }

  if (!policyExists) {
    await createILMPolicy(client, {
      name: ilmPolicyName,
      hotPhase: {
        min_age: '0ms',
        actions: {
          rollover: { max_size: '50GB', max_age: '30d' },
          set_priority: { priority: 100 },
        },
      },
      deletePhase: {
        min_age: '365d',
        actions: { delete: {} },
      },
    });
  }

  await client.indices.create({
    index: `${index}-000001`,
    settings: {
      'index.lifecycle.name': ilmPolicyName,
      'index.lifecycle.rollover_alias': index,
      number_of_shards: 2,
      number_of_replicas: 1,
    },
    mappings: mapping,
  });

  await client.indices.putAlias({ index: `${index}-000001`, alias: index });
  return { created: true, index: `${index}-000001`, alias: index };
};

const getILMPolicy = async (client, name) => {
  try {
    const result = await client.ilm.getLifecycle({ name });
    return result[name] || null;
  } catch {
    return null;
  }
};

const listILMPolicies = async (client) => {
  try {
    const result = await client.ilm.getLifecycle();
    return Object.keys(result);
  } catch {
    return [];
  }
};

const deleteILMPolicy = async (client, name) => {
  try {
    await client.ilm.deleteLifecycle({ name });
    return { deleted: true, name };
  } catch {
    return { deleted: false, name };
  }
};

module.exports = {
  createILMPolicy,
  createIndexWithILM,
  getILMPolicy,
  listILMPolicies,
  deleteILMPolicy,
};
