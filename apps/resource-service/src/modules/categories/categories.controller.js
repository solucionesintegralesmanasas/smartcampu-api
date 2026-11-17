class CategoriesController {
  /**
   * @param {import('./categories.service')} categoriesService
   */
  constructor(categoriesService) {
    this.categoriesService = categoriesService;
  }

  async findAll(req, res, next) {
    try {
      const result = await this.categoriesService.findAll(req.query);
      res.status(200).json({ success: true, data: result.data, meta: result.meta });
    } catch (error) {
      next(error);
    }
  }

  async findOne(req, res, next) {
    try {
      const data = await this.categoriesService.findOne(req.params.id);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const data = await this.categoriesService.create(req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const data = await this.categoriesService.update(req.params.id, req.body);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async remove(req, res, next) {
    try {
      await this.categoriesService.remove(req.params.id);
      res.status(200).json({ success: true, message: 'Categoría desactivada correctamente' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = CategoriesController;
