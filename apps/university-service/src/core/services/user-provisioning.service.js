const { hashPassword } = require('@uajs/shared-utils');
const { v4: uuidv4 } = require('uuid');

const { getMysqlPool } = require('../../config/database/mysql');
const logger = require('../../config/logger');

class UserProvisioningService {
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
   * Genera o vincula un usuario en el sistema de autenticación (uajs_auth)
   * asignándole su rol correspondiente (STUDENT o TEACHER).
   *
   * @param {Object} params
   * @param {Object} params.person - Datos de la persona natural
   * @param {'STUDENT'|'TEACHER'} params.roleName - Rol a asignar
   * @param {string} [params.customPassword] - Contraseña opcional
   * @param {Object} [conn] - Conexión MySQL transaccional opcional
   * @returns {Promise<{ userUuid: string, email: string, userId?: number, role: string }>}
   */
  async provisionUser({ person, roleName, customPassword = null }, conn = null) {
    const executor = conn || this.getPool();

    // 1. Determinar correo electrónico institucional o personal
    let email = person?.email?.trim().toLowerCase();
    if (!email) {
      const primerNombre = (person?.primerNombre || person?.first_name || 'usuario')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
      const primerApellido = (person?.primerApellido || person?.last_name || 'uajs')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
      const doc = person?.numeroDocumento || person?.document_number || Date.now();
      const domain = roleName === 'STUDENT' ? 'estudiantes.uajs.edu.co' : 'docentes.uajs.edu.co';
      email = `${primerNombre}.${primerApellido}.${doc}@${domain}`;
    }

    const defaultPassword = customPassword || 'uajs206**';

    try {
      // 2. Comprobar si ya existe el usuario en uajs_auth.users
      const existingUsers = await executor.query(
        'SELECT id, uuid, email FROM uajs_auth.users WHERE email = ? LIMIT 1',
        [email],
      );

      let userId;
      let userUuid;

      if (existingUsers && existingUsers.length > 0) {
        userId = existingUsers[0].id;
        userUuid = existingUsers[0].uuid;
        logger.info(`Usuario existente encontrado para ${email} (uuid: ${userUuid})`);
      } else {
        // 3. Crear nuevo usuario en uajs_auth.users
        userUuid = uuidv4();
        const passwordHash = await hashPassword(defaultPassword);

        // Opcionalmente sincronizar la persona en uajs_auth.persons
        let authPersonId = null;
        try {
          const docTypeCode = person?.tipoDocumento || person?.document_type_code || 'CC';
          const docNumberRaw = person?.numeroDocumento || person?.document_number;
          const docNumber = docNumberRaw || String(Date.now());
          const firstName = person?.primerNombre || person?.first_name || '';
          const middleName = person?.segundoNombre || person?.middle_name || null;
          const lastName = person?.primerApellido || person?.last_name || '';
          const secondLastName = person?.segundoApellido || person?.second_last_name || null;

          const personResult = await executor.query(
            `INSERT INTO uajs_auth.persons 
             (uuid, document_type_code, document_number, first_name,
              middle_name, last_name, second_last_name, email)
             VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
            [docTypeCode, docNumber, firstName, middleName, lastName, secondLastName, email],
          );
          authPersonId = personResult.insertId || null;
        } catch (err) {
          logger.debug('No se pudo insertar en uajs_auth.persons (no crítico)', {
            error: err.message,
          });
        }

        const userResult = await executor.query(
          `INSERT INTO uajs_auth.users 
           (uuid, person_id, email, password_hash, is_active)
           VALUES (?, ?, ?, ?, 1)`,
          [userUuid, authPersonId, email, passwordHash],
        );

        userId = userResult.insertId;
        logger.info(`Nuevo usuario creado en uajs_auth para ${email} (uuid: ${userUuid})`);
      }

      // 4. Asignar rol en uajs_auth.user_roles
      try {
        const roleRows = await executor.query(
          'SELECT id FROM uajs_auth.roles WHERE name = ? LIMIT 1',
          [roleName],
        );
        const fallbackRoleId = roleName === 'STUDENT' ? 3 : 4;
        const roleId = roleRows && roleRows.length > 0 ? roleRows[0].id : fallbackRoleId;

        if (userId && roleId) {
          await executor.query(
            `INSERT IGNORE INTO uajs_auth.user_roles 
             (user_id, role_id, assigned_at)
             VALUES (?, ?, NOW())`,
            [userId, roleId],
          );
          logger.info(`Rol ${roleName} asignado al usuario ${userUuid}`);
        }
      } catch (roleErr) {
        logger.warn(`No se pudo asignar rol ${roleName} en uajs_auth.user_roles`, {
          error: roleErr.message,
        });
      }

      return {
        userUuid,
        email,
        userId,
        role: roleName,
      };
    } catch (error) {
      // Fallback resiliente si uajs_auth no está disponible en este entorno
      logger.warn(
        `Aprovisionamiento en uajs_auth no completado (${error.message}). Usando UUID generado.`,
      );
      return {
        userUuid: uuidv4(),
        email,
        role: roleName,
      };
    }
  }
}

module.exports = UserProvisioningService;
