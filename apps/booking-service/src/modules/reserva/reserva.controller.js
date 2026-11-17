class ReservaController {
  constructor(reservaService) {
    this.reservaService = reservaService;
  }

  async create(req, res, next) {
    try {
      const result = await this.reservaService.create(req.body, req.user);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async findAll(req, res, next) {
    try {
      const {
        page = 1, limit = 10, statusId, resourceUuid,
      } = req.query;
      const result = await this.reservaService.findAll(req.user, {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        statusId: statusId ? parseInt(statusId, 10) : undefined,
        resourceUuid,
      });
      res.status(200).json({ success: true, data: result.data, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async findById(req, res, next) {
    try {
      const result = await this.reservaService.findById(req.params.id, req.user);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async findHistory(req, res, next) {
    try {
      const result = await this.reservaService.findHistory(req.params.id, req.user);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async approve(req, res, next) {
    try {
      const result = await this.reservaService.approve(req.params.id, req.user);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async reject(req, res, next) {
    try {
      const result = await this.reservaService.reject(req.params.id, req.user, req.body.reason);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async confirm(req, res, next) {
    try {
      const result = await this.reservaService.confirm(req.params.id, req.user);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async cancel(req, res, next) {
    try {
      const result = await this.reservaService.cancel(req.params.id, req.user, req.body.reason);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async complete(req, res, next) {
    try {
      const result = await this.reservaService.complete(req.params.id, req.user);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ReservaController;
