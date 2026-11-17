const { env } = require('../../config/env');
const logger = require('../../config/logger');
const { NotFoundError } = require('../../core/exceptions');

const ACADEMIC_PROFILE_ROLES = {
  STUDENT: 'estudiante',
  TEACHER: 'docente',
};

class PerfilService {
  constructor(usuarioRepository) {
    this.usuarioRepository = usuarioRepository;
  }

  async getPerfil(userId) {
    const user = await this.usuarioRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('Usuario no encontrado');
    }

    const perfil = await this.getPerfilAcademico(user);

    return { ...user, perfil };
  }

  async updatePerfil(userId, updateDto) {
    const user = await this.usuarioRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('Usuario no encontrado');
    }

    const updated = await this.usuarioRepository.update(userId, updateDto);
    const perfil = await this.getPerfilAcademico(updated);

    return { ...updated, perfil };
  }

  /**
   * Enriquece el perfil con datos de estudiante/docente, que viven en
   * university-service (Fase 2 del plan). Mientras ese servicio no exista o
   * no responda, degrada a { tipo: 'basico' } en vez de fallar: el perfil
   * básico (identidad + roles) sigue siendo útil por sí solo.
   */
  async getPerfilAcademico(user) {
    const academicRole = user.roles.find((role) => ACADEMIC_PROFILE_ROLES[role]);
    if (!academicRole || !env.SERVICE_UNIVERSITY_URL) {
      return { tipo: 'basico' };
    }

    const tipo = ACADEMIC_PROFILE_ROLES[academicRole];
    try {
      // university-service guarda user_uuid (el UUID de auth-service), no
      // el id numérico interno de esta base — deben coincidir.
      const response = await this.fetchWithTimeout(
        `${env.SERVICE_UNIVERSITY_URL}/api/v1/university/${tipo}s/by-user/${user.uuid}`,
      );
      if (!response.ok) {
        return { tipo: 'basico' };
      }
      const data = await response.json();
      return { tipo, [tipo]: data.data ?? data };
    } catch (error) {
      logger.warn('No se pudo enriquecer el perfil con university-service', {
        userId: user.id,
        error: error.message,
      });
      return { tipo: 'basico' };
    }
  }

  async fetchWithTimeout(url, timeoutMs = 3000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        signal: controller.signal,
        headers: { 'X-Service-Token': env.SERVICE_AUTH_TOKEN },
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

module.exports = PerfilService;
