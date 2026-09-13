const crypto = require('crypto');

const { createMysqlPool } = require('@uajs/database-client');

const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const { NotFoundError } = require('../../core/exceptions');

class ArchivoRepository {
  constructor() {
    this.pool = null;
  }

  async getPool() {
    if (!this.pool) {
      this.pool = createMysqlPool({
        host: env.MYSQL_HOST,
        port: env.MYSQL_PORT,
        user: env.MYSQL_USER,
        password: env.MYSQL_PASSWORD,
        database: env.MYSQL_DATABASE,
        connectionLimit: 10,
      });
    }
    return this.pool;
  }

  async findById(id) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT id, uuid, nombre_original, nombre_sistema, ruta_acceso, mime_type, peso_bytes,
              entidad_asociada, uuid_asociado, subido_por, subido_por_nombre, extension,
              carpeta, publico, activo, createdAt, updatedAt
       FROM archivos
       WHERE id = ? AND deleted_at IS NULL`,
      [id],
    );
    return rows[0] || null;
  }

  async findByUuid(uuid) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT id, uuid, nombre_original, nombre_sistema, ruta_acceso, mime_type, peso_bytes,
              entidad_asociada, uuid_asociado, subido_por, subido_por_nombre, extension,
              carpeta, publico, activo, createdAt, updatedAt
       FROM archivos
       WHERE uuid = ? AND deleted_at IS NULL`,
      [uuid],
    );
    return rows[0] || null;
  }

  async findAll({
    page = 1, limit = 20, usuarioId, tipo, entidad, activo,
  }) {
    const pool = await this.getPool();
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE deleted_at IS NULL';
    const params = [];

    if (usuarioId) {
      whereClause += ' AND subido_por = ?';
      params.push(usuarioId);
    }
    if (tipo) {
      whereClause += ' AND mime_type = ?';
      params.push(tipo);
    }
    if (entidad) {
      whereClause += ' AND entidad_asociada = ?';
      params.push(entidad);
    }
    if (activo !== undefined) {
      whereClause += ' AND activo = ?';
      params.push(activo ? 1 : 0);
    }

    const countRows = await pool.query(
      `SELECT COUNT(*) as total FROM archivos ${whereClause}`,
      params,
    );
    const [{ total }] = countRows;

    const rows = await pool.query(
      `SELECT id, uuid, nombre_original, nombre_sistema, ruta_acceso, mime_type, peso_bytes,
              entidad_asociada, uuid_asociado, subido_por, subido_por_nombre, extension,
              carpeta, publico, activo, createdAt, updatedAt
       FROM archivos
       ${whereClause}
       ORDER BY createdAt DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    return { files: rows, total };
  }

  async create(data) {
    const pool = await this.getPool();
    const conn = await pool.beginTransaction();
    try {
      const uuid = crypto.randomUUID();
      const result = await conn.query(
        `INSERT INTO archivos (
          uuid, nombre_original, nombre_sistema, ruta_acceso, mime_type, peso_bytes,
          entidad_asociada, uuid_asociado, subido_por, subido_por_nombre, extension,
          carpeta, publico, activo, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
        [
          uuid,
          data.nombreOriginal,
          data.nombreAlmacenado,
          data.ruta,
          data.tipo,
          data.tamano,
          data.entidadAsociada || null,
          data.uuidAsociado || null,
          data.usuarioId || null,
          data.usuarioNombre || null,
          data.extension,
          data.carpeta || 'general',
          data.publico ? 1 : 0,
        ],
      );

      await conn.commit();
      return this.findById(result.insertId);
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  async update(id, data) {
    const pool = await this.getPool();
    const conn = await pool.beginTransaction();
    try {
      const existing = await this.findById(id);
      if (!existing) {
        throw new NotFoundError('Archivo no encontrado');
      }

      const fields = [];
      const params = [];

      if (data.nombreOriginal !== undefined) {
        fields.push('nombre_original = ?');
        params.push(data.nombreOriginal);
      }
      if (data.entidadAsociada !== undefined) {
        fields.push('entidad_asociada = ?');
        params.push(data.entidadAsociada);
      }
      if (data.uuidAsociado !== undefined) {
        fields.push('uuid_asociado = ?');
        params.push(data.uuidAsociado);
      }
      if (data.carpeta !== undefined) {
        fields.push('carpeta = ?');
        params.push(data.carpeta);
      }
      if (data.publico !== undefined) {
        fields.push('publico = ?');
        params.push(data.publico ? 1 : 0);
      }
      if (data.activo !== undefined) {
        fields.push('activo = ?');
        params.push(data.activo ? 1 : 0);
      }

      if (fields.length > 0) {
        fields.push('updatedAt = NOW()');
        params.push(id);
        await conn.query(`UPDATE archivos SET ${fields.join(', ')} WHERE id = ?`, params);
      }

      await conn.commit();
      return this.findById(id);
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  async delete(id) {
    const pool = await this.getPool();
    const conn = await pool.beginTransaction();
    try {
      const existing = await this.findById(id);
      if (!existing) {
        throw new NotFoundError('Archivo no encontrado');
      }

      await conn.query('UPDATE archivos SET deleted_at = NOW(), activo = 0 WHERE id = ?', [id]);

      await conn.commit();
      return { success: true };
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  async searchInElasticsearch(query) {
    const searchTerm = query.search || '';
    const response = await esClient.search({
      index: env.STORAGE_INDEX,
      query: {
        bool: {
          must: [
            {
              bool: {
                should: [
                  {
                    multi_match: {
                      query: searchTerm,
                      fields: ['nombre_original', 'nombre_sistema', 'carpeta'],
                      type: 'best_fields',
                      fuzziness: 'AUTO',
                    },
                  },
                  {
                    wildcard: { nombre_original: `*${searchTerm.toLowerCase()}*` },
                  },
                  {
                    wildcard: { nombre_sistema: `*${searchTerm.toLowerCase()}*` },
                  },
                ],
                minimum_should_match: 1,
              },
            },
          ],
          filter: [
            query.usuarioId ? { term: { subido_por: query.usuarioId } } : null,
            query.tipo ? { term: { mime_type: query.tipo } } : null,
            query.entidad ? { term: { entidad_asociada: query.entidad } } : null,
            query.activo !== undefined ? { term: { activo: query.activo } } : null,
          ].filter(Boolean),
        },
      },
      from: query.offset || 0,
      size: query.limit || 20,
      sort: [{ createdAt: { order: 'desc' } }],
    });

    const hits = response.hits || { total: { value: 0 }, hits: [] };
    const total = typeof hits.total === 'number' ? hits.total : hits.total.value;

    return {
      total,
      // _source es convención oficial de la API de Elasticsearch
      // eslint-disable-next-line no-underscore-dangle
      files: hits.hits.map((hit) => hit._source),
    };
  }
}

module.exports = ArchivoRepository;
