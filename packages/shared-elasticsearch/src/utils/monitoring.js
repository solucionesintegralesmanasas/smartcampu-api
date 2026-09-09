const collectMetrics = (client) => ({
  cluster: {
    health: async () => {
      const h = await client.client.cluster.health();
      return {
        status: h.status,
        nodes: h.number_of_nodes,
        dataNodes: h.number_of_data_nodes,
        shards: h.active_shards,
        unassignedShards: h.unassigned_shards,
      };
    },
    stats: async () => {
      const s = await client.client.cluster.stats();
      return { nodes: s.nodes, fs: s.fs, jvm: s.jvm };
    },
  },
  indices: {
    stats: async (indexPattern = '*') => {
      const s = await client.client.indices.stats({ index: indexPattern });
      return Object.keys(s.indices).map((idx) => ({
        index: idx,
        docs: s.indices[idx].total.docs.count,
        size: s.indices[idx].total.store.size_in_bytes,
        queryTime: s.indices[idx].total.search.query_time_in_millis,
        indexTime: s.indices[idx].total.indexing.index_time_in_millis,
      }));
    },
  },
  nodes: {
    stats: async () => {
      const s = await client.client.nodes.stats();
      return Object.values(s.nodes).map((n) => ({
        name: n.name,
        cpu: n.process.cpu.percent,
        memory: n.process.mem.total_in_bytes,
        heap: n.jvm.mem.heap_used_percent,
        disk: n.fs.total.used_percent,
      }));
    },
  },
  bulk: {
    stats: async () => {
      const s = await client.client.nodes.stats({ metric: 'bulk' });
      return Object.values(s.nodes).map((n) => ({
        name: n.name,
        queue: n.thread_pool.bulk.queue,
        active: n.thread_pool.bulk.active,
        rejected: n.thread_pool.bulk.rejected,
      }));
    },
  },
});

const prometheusMiddleware = (client) => {
  const metrics = collectMetrics(client);
  return async (req, res, next) => {
    if (req.path === '/metrics/es') {
      try {
        const [health, nodes, indices] = await Promise.all([
          metrics.cluster.health(),
          metrics.nodes.stats(),
          metrics.indices.stats(),
        ]);
        const lines = [];
        lines.push('# HELP uajs_es_cluster_health Elasticsearch cluster health');
        lines.push('# TYPE uajs_es_cluster_health gauge');
        lines.push(`uajs_es_cluster_health{status="${health.status}"} 1`);
        lines.push(`uajs_es_cluster_nodes ${health.nodes}`);
        lines.push(`uajs_es_cluster_shards ${health.shards}`);
        nodes.forEach((n) => {
          lines.push(`uajs_es_node_cpu{node="${n.name}"} ${n.cpu}`);
          lines.push(`uajs_es_node_memory{node="${n.name}"} ${n.memory}`);
          lines.push(`uajs_es_node_heap{node="${n.name}"} ${n.heap}`);
        });
        indices.forEach((i) => {
          lines.push(`uajs_es_index_docs{index="${i.index}"} ${i.docs}`);
          lines.push(`uajs_es_index_size{index="${i.index}"} ${i.size}`);
        });
        res.set('Content-Type', 'text/plain');
        res.send(`${lines.join('\n')}\n`);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
      return;
    }
    next();
  };
};

const healthCheckMiddleware = (client) => async (req, res, next) => {
  if (req.path === '/health/es') {
    try {
      const health = await client.client.cluster.health();
      const { status } = health;
      res.status(status === 'green' ? 200 : status === 'yellow' ? 200 : 503).json({
        success: status !== 'red',
        status,
        nodes: health.number_of_nodes,
        shards: health.active_shards,
      });
    } catch (error) {
      res.status(503).json({ success: false, status: 'unavailable', error: error.message });
    }
    return;
  }
  next();
};

module.exports = { collectMetrics, prometheusMiddleware, healthCheckMiddleware };
