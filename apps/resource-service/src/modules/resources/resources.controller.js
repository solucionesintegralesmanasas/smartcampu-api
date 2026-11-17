class ResourcesController {
  /**
   * @param {import('./resources.service')} resourcesService
   */
  constructor(resourcesService) {
    this.resourcesService = resourcesService;
  }

  async findAll(req, res, next) {
    try {
      const result = await this.resourcesService.findAll(req.query);
      res.status(200).json({ success: true, data: result.data, meta: result.meta });
    } catch (error) {
      next(error);
    }
  }

  async findOne(req, res, next) {
    try {
      const data = await this.resourcesService.findOne(req.params.id);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const data = await this.resourcesService.create(req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const data = await this.resourcesService.update(req.params.id, req.body);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async remove(req, res, next) {
    try {
      await this.resourcesService.remove(req.params.id);
      res.status(200).json({ success: true, message: 'Recurso desactivado correctamente' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ResourcesController;
