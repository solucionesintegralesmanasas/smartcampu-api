const { v4: uuidv4 } = require('uuid');

const { getMysqlPool } = require('../../config/database/mysql');

const COLUMNAS = `
  id, code, name, channel, subject, body_text AS bodyText, body_html AS bodyHtml,
  variables, is_active AS isActive, updated_at AS updatedAt`;

const parsearVariables = (valor) => {
  if (Array.isArray(valor)) return valor;
  if (typeof valor === 'string' && valor) {
    try {
      return JSON.parse(valor);
    } catch (error) {
      return [];
    }
  }
  return [];
};

const formatear = (row) => {
  if (!row) return null;
  return {
    ...row,
    isActive: Boolean(row.isActive),
    variables: parsearVariables(row.variables),
  };
};

class PlantillasRepository {
  constructor(pool = null) {
    this.pool = pool;
  }

  getPool() {
    if (!this.pool) {
      this.pool = getMysqlPool();
    }
    return this.pool;
  }

  /**
   * Plantilla por código y canal, esté activa o no.
   * @returns {Promise<Object|null>}
   */
  async findOne(code, channel) {
    const rows = await this.getPool().query(
      `SELECT ${COLUMNAS} FROM notification_templates WHERE code = ? AND channel = ? LIMIT 1`,
      [code, channel],
    );
    return formatear(rows[0]);
  }

  async findPaginated({ limit, offset }) {
    const pool = this.getPool();
    const conteo = await pool.query('SELECT COUNT(*) AS total FROM notification_templates');
    const rows = await pool.query(
      `SELECT ${COLUMNAS} FROM notification_templates
       ORDER BY code ASC, channel ASC LIMIT ? OFFSET ?`,
      [limit, offset],
    );
    return { rows: rows.map(formatear), total: conteo[0]?.total || 0 };
  }

  /**
   * Crea o actualiza la plantilla identificada por (code, channel).
   * @param {Object} data - { code, name, channel, subject, bodyText, bodyHtml, variables, isActive }
   */
  async upsert(data) {
    await this.getPool().query(
      `INSERT INTO notification_templates
         (uuid, code, name, channel, subject, body_text, body_html, variables, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         subject = VALUES(subject),
         body_text = VALUES(body_text),
         body_html = VALUES(body_html),
         variables = VALUES(variables),
         is_active = VALUES(is_active)`,
      [
        uuidv4(),
        data.code,
        data.name,
        data.channel,
        data.subject ?? null,
        data.bodyText,
        data.bodyHtml ?? null,
        JSON.stringify(data.variables || []),
        data.isActive === false ? 0 : 1,
      ],
    );
    return this.findOne(data.code, data.channel);
  }
}

module.exports = PlantillasRepository;
