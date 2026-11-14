const { paginationHelper } = require('../../core/helpers/pagination.helper');

class DepartmentController {
  constructor(departmentService) {
    this.departmentService = departmentService;
  }

  async create(req, res, next) {
    try {
      const result = await this.departmentService.create(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async findAll(req, res, next) {
    try {
      const { page, limit } = paginationHelper(req.query.page, req.query.limit ?? 10);
      const result = await this.departmentService.findAll({ page, limit });
      res.status(200).json({ success: true, data: result.data, meta: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async findById(req, res, next) {
    try {
      const result = await this.departmentService.findById(req.params.id);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const result = await this.departmentService.update(req.params.id, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      await this.departmentService.delete(req.params.id);
      res.status(200).json({ success: true, message: 'Departamento eliminado correctamente' });
    } catch (error) {
      next(error);
    }
  }

  async search(req, res, next) {
    try {
      const result = await this.departmentService.search(req.query.search);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = DepartmentController;
