class UsuarioController {
  constructor(usuarioService) {
    this.usuarioService = usuarioService;
  }

  async findAll(req, res, next) {
    try {
      const {
        page, limit, isActive, role,
      } = req.query;
      const result = await this.usuarioService.findAll({
        page, limit, isActive, role,
      });
      res.status(200).json({ success: true, data: result.data, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async findById(req, res, next) {
    try {
      const result = await this.usuarioService.findById(req.params.id);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const result = await this.usuarioService.update(req.params.id, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async updateRoles(req, res, next) {
    try {
      const result = await this.usuarioService.updateRoles(
        req.params.id,
        req.body.roles,
        req.user?.id,
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async deactivate(req, res, next) {
    try {
      await this.usuarioService.deactivate(req.params.id);
      res.status(200).json({ success: true, message: 'Usuario desactivado correctamente' });
    } catch (error) {
      next(error);
    }
  }

  async search(req, res, next) {
    try {
      const { search } = req.query;
      const result = await this.usuarioService.search(search);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = UsuarioController;
