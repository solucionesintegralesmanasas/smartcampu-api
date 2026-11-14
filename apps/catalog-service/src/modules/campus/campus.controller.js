const { paginationHelper } = require('../../core/helpers/pagination.helper');

class CampusController {
  constructor(campusService) {
    this.campusService = campusService;
  }

  async create(req, res, next) {
    try {
      const result = await this.campusService.create(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async findAll(req, res, next) {
    try {
      const { page, limit } = paginationHelper(req.query.page, req.query.limit ?? 10);
      const result = await this.campusService.findAll({ page, limit });
      res.status(200).json({ success: true, data: result.data, meta: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async findById(req, res, next) {
    try {
      const result = await this.campusService.findById(req.params.id);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async findByCityId(req, res, next) {
    try {
      const result = await this.campusService.findByCityId(req.params.cityId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const result = await this.campusService.update(req.params.id, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      await this.campusService.delete(req.params.id);
      res.status(200).json({ success: true, message: 'Sede eliminada correctamente' });
    } catch (error) {
      next(error);
    }
  }

  async search(req, res, next) {
    try {
      const result = await this.campusService.search(req.query.search);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = CampusController;
