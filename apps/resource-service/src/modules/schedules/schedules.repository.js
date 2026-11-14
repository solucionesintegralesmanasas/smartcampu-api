const { getMysqlPool } = require('../../config/database/mysql');
const { toMysqlTime } = require('../../core/helpers/time.helper');

const SELECT_SCHEDULE = `SELECT day_of_week AS diaSemana,
    TIME_FORMAT(open_time, '%H:%i') AS horaApertura,
    TIME_FORMAT(close_time, '%H:%i') AS horaCierre
  FROM resource_schedules`;

class SchedulesRepository {
  constructor(pool = null) {
    this.pool = pool;
  }

  getPool() {
    if (!this.pool) {
      this.pool = getMysqlPool();
    }
    return this.pool;
  }

  async findByResource(resourceId) {
    return this.getPool().query(
      `${SELECT_SCHEDULE} WHERE resource_id = ? AND is_active = 1 ORDER BY day_of_week ASC`,
      [resourceId],
    );
  }

  async findByResourceAndDay(resourceId, dayOfWeek) {
    const [row] = await this.getPool().query(
      `${SELECT_SCHEDULE} WHERE resource_id = ? AND day_of_week = ? AND is_active = 1 LIMIT 1`,
      [resourceId, dayOfWeek],
    );
    return row || null;
  }

  /**
   * Reemplaza el horario semanal completo del recurso dentro de una transacción.
   * @param {number} resourceId
   * @param {Array<{ diaSemana: number, horaApertura: string, horaCierre: string }>} horarios
   */
  async replaceForResource(resourceId, horarios) {
    const conn = await this.getPool().beginTransaction();
    try {
      await conn.query('DELETE FROM resource_schedules WHERE resource_id = ?', [resourceId]);
      if (horarios.length > 0) {
        const placeholders = horarios.map(() => '(?, ?, ?, ?)').join(', ');
        const params = horarios.flatMap((horario) => [
          resourceId,
          horario.diaSemana,
          toMysqlTime(horario.horaApertura),
          toMysqlTime(horario.horaCierre),
        ]);
        await conn.query(
          `INSERT INTO resource_schedules (resource_id, day_of_week, open_time, close_time)
           VALUES ${placeholders}`,
          params,
        );
      }
      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }
}

module.exports = SchedulesRepository;
