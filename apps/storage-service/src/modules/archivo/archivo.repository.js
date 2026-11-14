const crypto = require('crypto');

const { createMysqlPool } = require('@uajs/database-client');

const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');

const COLUMNS = `id, uuid, nombre_original, nombre_sistema, ruta_acceso, mime_type, peso_bytes,
  extension, entidad_asociada, uuid_asociado, subido_por, subido_por_nombre, carpeta,
  publico, activo, createdAt, updatedAt`;

const CAMPOS_ACTUALIZABLES = Object.freeze({
  nombreOriginal: 'nombre_original',
  entidadAsociada: 'entidad_asociada',
  uuidAsociado: 'uuid_asociado',
  carpeta: 'carpeta',
  publico: 'publico',
  activo: 'activo',
});

const toArchivo = (row) => (row
  ? { ...row, publico: Boolean(row.publico), activo: Boolean(row.activo) }
  : null);

const escapeLike = (value) => value.replace(/[\\%_]/g, '\\$&');

const escapeWildcard = (value) => value.replace(/[*?\\]/g, '\\$&');

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

  /**
   * Construye el WHERE de listados. Los usuarios sin permisos de gestión solo
   * ven sus propios archivos y los públicos activos.
   */
  buildWhere(scope, filtros) {
    const clauses = ['deleted_at IS NULL'];
    const params = [];

    if (!scope.puedeVerTodo) {
      clauses.push('(subido_por = ? OR (publico = 1 AND activo = 1))');
      params.push(scope.usuarioId);
    }
    if (filtros.search) {
      clauses.push('nombre_original LIKE ?');
      params.push(`%${escapeLike(filtros.search)}%`);
    }
    if (filtros.usuarioId) {
      clauses.push('subido_por = ?');
      params.push(filtros.usuarioId);
    }
    if (filtros.tipo) {
      clauses.push('mime_type = ?');
      params.push(filtros.tipo);
    }
    if (filtros.entidad) {
      clauses.push('entidad_asociada = ?');
      params.push(filtros.entidad);
    }
    if (filtros.uuidAsociado) {
      clauses.push('uuid_asociado = ?');
      params.push(filtros.uuidAsociado);
    }
    if (filtros.carpeta) {
      clauses.push('carpeta = ?');
      params.push(filtros.carpeta);
    }
    if (filtros.activo !== undefined) {
      clauses.push('activo = ?');
      params.push(filtros.activo ? 1 : 0);
    }

    return { where: `WHERE ${clauses.join(' AND ')}`, params };
  }

  async findByUuid(uuid) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${COLUMNS} FROM archivos WHERE uuid = ? AND deleted_at IS NULL`,
      [uuid],
    );
    return toArchivo(rows[0]);
  }

  async findAll({
    page = 1,
    limit = 20,
    scope = { usuarioId: null, puedeVerTodo: false },
    ...filtros
  }) {
    const pool = await this.getPool();
    const { where, params } = this.buildWhere(scope, filtros);

    const [{ total }] = await pool.query(
      `SELECT COUNT(*) AS total FROM archivos ${where}`,
      params,
    );
    const rows = await pool.query(
      `SELECT ${COLUMNS} FROM archivos ${where}
       ORDER BY createdAt DESC, id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, (page - 1) * limit],
    );

    return { files: rows.map(toArchivo), total: Number(total) };
  }

  /**
   * Inserta el archivo y devuelve la fila persistida dentro de la misma transacción.
   */
  async create(data) {
    const pool = await this.getPool();
    const tx = await pool.beginTransaction();
    try {
      const result = await tx.query(
        `INSERT INTO archivos (
          uuid, nombre_original, nombre_sistema, ruta_acceso, mime_type, peso_bytes,
          extension, entidad_asociada, uuid_asociado, subido_por, subido_por_nombre,
          carpeta, publico, activo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          crypto.randomUUID(),
          data.nombreOriginal,
          data.nombreSistema,
          data.rutaAcceso,
          data.mimeType,
          data.pesoBytes,
          data.extension,
          data.entidadAsociada ?? null,
          data.uuidAsociado ?? null,
          data.subidoPor ?? null,
          data.subidoPorNombre ?? null,
          data.carpeta || 'general',
          data.publico ? 1 : 0,
        ],
      );
      const [row] = await tx.query(`SELECT ${COLUMNS} FROM archivos WHERE id = ?`, [
        result.insertId,
      ]);
      await tx.commit();
      return toArchivo(row);
    } catch (error) {
      await tx.rollback();
      throw error;
    } finally {
      tx.release();
    }
  }

  /**
   * Actualiza solo los campos presentes. Devuelve null si el archivo no existe.
   */
  async update(id, data) {
    const pool = await this.getPool();
    const sets = [];
    const params = [];

    Object.entries(CAMPOS_ACTUALIZABLES).forEach(([campo, columna]) => {
      if (data[campo] !== undefined) {
        sets.push(`${columna} = ?`);
        params.push(typeof data[campo] === 'boolean' ? Number(data[campo]) : data[campo]);
      }
    });

    const tx = await pool.beginTransaction();
    try {
      if (sets.length > 0) {
        await tx.query(
          `UPDATE archivos SET ${sets.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
          [...params, id],
        );
      }
      const [row] = await tx.query(
        `SELECT ${COLUMNS} FROM archivos WHERE id = ? AND deleted_at IS NULL`,
        [id],
      );
      await tx.commit();
      return toArchivo(row);
    } catch (error) {
      await tx.rollback();
      throw error;
    } finally {
      tx.release();
    }
  }

  /**
   * Soft delete: marca deleted_at y desactiva el registro. El binario se conserva.
   */
  async delete(id) {
    const pool = await this.getPool();
    const tx = await pool.beginTransaction();
    try {
      const result = await tx.query(
        'UPDATE archivos SET deleted_at = NOW(), activo = 0 WHERE id = ? AND deleted_at IS NULL',
        [id],
      );
      await tx.commit();
      return result.affectedRows > 0;
    } catch (error) {
      await tx.rollback();
      throw error;
    } finally {
      tx.release();
    }
  }

  async searchInElasticsearch({
    search,
    page = 1,
    limit = 20,
    scope = { usuarioId: null, puedeVerTodo: false },
    usuarioId,
    tipo,
    entidad,
    uuidAsociado,
    carpeta,
    activo,
  }) {
    const filter = [];

    if (!scope.puedeVerTodo) {
      filter.push({
        bool: {
          should: [
            { term: { subido_por: scope.usuarioId } },
            { bool: { must: [{ term: { publico: true } }, { term: { activo: true } }] } },
          ],
          minimum_should_match: 1,
        },
      });
    }
    if (usuarioId) filter.push({ term: { subido_por: usuarioId } });
    if (tipo) filter.push({ term: { mime_type: tipo } });
    if (entidad) filter.push({ term: { entidad_asociada: entidad } });
    if (uuidAsociado) filter.push({ term: { uuid_asociado: uuidAsociado } });
    if (carpeta) filter.push({ term: { carpeta } });
    if (activo !== undefined) filter.push({ term: { activo } });

    const response = await esClient.search({
      index: env.STORAGE_INDEX,
      from: (page - 1) * limit,
      size: limit,
      query: {
        bool: {
          must: [
            {
              bool: {
                should: [
                  {
                    multi_match: {
                      query: search,
                      fields: ['nombre_original^2', 'subido_por_nombre'],
                      type: 'best_fields',
                      fuzziness: 'AUTO',
                    },
                  },
                  {
                    wildcard: {
                      'nombre_original.keyword': {
                        value: `*${escapeWildcard(search)}*`,
                        case_insensitive: true,
                      },
                    },
                  },
                ],
                minimum_should_match: 1,
              },
            },
          ],
          filter,
        },
      },
      sort: [{ createdAt: { order: 'desc' } }],
    });

    const { hits } = response;
    const total = typeof hits.total === 'number' ? hits.total : hits.total.value;

    return {
      total,
      // eslint-disable-next-line no-underscore-dangle
      files: hits.hits.map((hit) => hit._source),
    };
  }
}

module.exports = ArchivoRepository;
