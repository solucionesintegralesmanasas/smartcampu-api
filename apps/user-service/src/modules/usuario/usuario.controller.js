/**
 * Controlador de perfiles y preferencias de usuario.
 */
class UsuarioController {
  /**
   * @param {import('./usuario.service')} usuarioService - Servicio de usuarios.
   */
  constructor(usuarioService) {
    this.usuarioService = usuarioService;
  }

  /**
   * Devuelve el perfil del usuario autenticado.
   */
  async getMiPerfil(req, res, next) {
    try {
      const result = await this.usuarioService.getMiPerfil(req.userId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Crea o actualiza el perfil del usuario autenticado.
   */
  async upsertMiPerfil(req, res, next) {
    try {
      const result = await this.usuarioService.upsertMiPerfil(req.userId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Devuelve las preferencias del usuario autenticado.
   */
  async getMisPreferencias(req, res, next) {
    try {
      const result = await this.usuarioService.getMisPreferencias(req.userId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Crea o actualiza las preferencias del usuario autenticado.
   */
  async upsertMisPreferencias(req, res, next) {
    try {
      const result = await this.usuarioService.upsertMisPreferencias(req.userId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Devuelve el perfil de un usuario por su id (ADMIN o STAFF).
   */
  async getPerfilPorUsuario(req, res, next) {
    try {
      const result = await this.usuarioService.getPerfilPorUsuario(req.params.userId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Lista perfiles paginados con búsqueda opcional (ADMIN o STAFF).
   */
  async listarPerfiles(req, res, next) {
    try {
      const { data, meta } = await this.usuarioService.listarPerfiles(req.query);
      res.status(200).json({ success: true, data, meta });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Elimina lógicamente el perfil de un usuario (solo ADMIN).
   */
  async eliminarPerfil(req, res, next) {
    try {
      const result = await this.usuarioService.eliminarPerfil(req.params.userId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = UsuarioController;
