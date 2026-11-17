class PerfilController {
  constructor(perfilService) {
    this.perfilService = perfilService;
  }

  async getOwn(req, res, next) {
    try {
      const result = await this.perfilService.getPerfil(req.user.id);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const result = await this.perfilService.getPerfil(req.params.userId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async updateOwn(req, res, next) {
    try {
      const result = await this.perfilService.updatePerfil(req.user.id, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = PerfilController;
