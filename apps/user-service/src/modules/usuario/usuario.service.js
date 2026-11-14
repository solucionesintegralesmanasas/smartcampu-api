const { NotFoundError } = require('../../core/exceptions');
const { getPaginationMeta, paginationHelper } = require('../../core/helpers/pagination.helper');

/**
 * Servicio de perfiles y preferencias de usuario.
 * La identidad (cuenta, roles, contraseñas) pertenece a uajs_auth; aquí solo se
 * gestionan los datos de perfil y preferencias indexados por user_id.
 */
class UsuarioService {
  /**
   * @param {import('./usuario.repository')} usuarioRepository - Repositorio de usuarios.
   */
  constructor(usuarioRepository) {
    this.usuarioRepository = usuarioRepository;
  }

  async getMiPerfil(userId) {
    const perfil = await this.usuarioRepository.findPerfilByUserId(userId);
    if (!perfil) {
      throw new NotFoundError('El perfil no existe. Créelo con PUT /api/v1/usuarios/me');
    }
    return perfil;
  }

  async upsertMiPerfil(userId, perfilDto) {
    return this.usuarioRepository.upsertPerfil(userId, perfilDto);
  }

  async getMisPreferencias(userId) {
    const preferencias = await this.usuarioRepository.findPreferenciasByUserId(userId);
    if (!preferencias) {
      return this.buildDefaultPreferencias(userId);
    }
    return this.mapPreferencias(preferencias);
  }

  async upsertMisPreferencias(userId, preferenciasDto) {
    const preferencias = await this.usuarioRepository.upsertPreferencias(userId, preferenciasDto);
    return this.mapPreferencias(preferencias);
  }

  async getPerfilPorUsuario(userId) {
    const perfil = await this.usuarioRepository.findPerfilByUserId(userId);
    if (!perfil) {
      throw new NotFoundError(`Perfil del usuario con ID ${userId} no encontrado`);
    }
    return perfil;
  }

  async listarPerfiles(query = {}) {
    const { page, limit, offset } = paginationHelper(query.page, query.limit);
    const { rows, total } = await this.usuarioRepository.findAllPerfiles({
      limit,
      offset,
      search: query.search || '',
    });
    return {
      data: rows,
      meta: getPaginationMeta(page, limit, total),
    };
  }

  async eliminarPerfil(userId) {
    const eliminado = await this.usuarioRepository.softDeletePerfil(userId);
    if (!eliminado) {
      throw new NotFoundError(`Perfil del usuario con ID ${userId} no encontrado`);
    }
    return { message: 'Perfil eliminado correctamente' };
  }

  mapPreferencias(preferencias) {
    return {
      ...preferencias,
      notifyEmail: Boolean(preferencias.notifyEmail),
      notifyPush: Boolean(preferencias.notifyPush),
    };
  }

  buildDefaultPreferencias(userId) {
    return {
      id: null,
      uuid: null,
      userId,
      notifyEmail: true,
      notifyPush: true,
      quietHoursStart: null,
      quietHoursEnd: null,
      updatedAt: null,
    };
  }
}

module.exports = UsuarioService;
