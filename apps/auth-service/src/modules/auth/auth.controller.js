/**
 * Controlador de autenticación.
 */
class AuthController {
  /**
   * @param {import('./auth.service')} authService - Servicio de autenticación.
   */
  constructor(authService) {
    this.authService = authService;
  }

  /**
   * Maneja el registro de usuarios.
   */
  async register(req, res, next) {
    try {
      const result = await this.authService.register(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Maneja el inicio de sesión.
   */
  async login(req, res, next) {
    try {
      const result = await this.authService.login(req.body, req);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Maneja la renovación del token de acceso.
   */
  async refreshToken(req, res, next) {
    try {
      const result = await this.authService.refreshToken(req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Devuelve el perfil del usuario autenticado.
   */
  async me(req, res, next) {
    try {
      const result = await this.authService.getProfile(req.userId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Maneja el cierre de sesión.
   */
  async logout(req, res, next) {
    try {
      const result = await this.authService.logout(req.body, req);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Solicita el restablecimiento de contraseña.
   */
  async requestPasswordReset(req, res, next) {
    try {
      const result = await this.authService.requestPasswordReset(req.body.email);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Confirma el restablecimiento de contraseña.
   */
  async confirmPasswordReset(req, res, next) {
    try {
      const result = await this.authService.confirmPasswordReset(req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AuthController;
