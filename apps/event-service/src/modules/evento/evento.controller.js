class EventoController {
  constructor(eventoService) {
    this.eventoService = eventoService;
  }

  async create(req, res, next) {
    try {
      const result = await this.eventoService.create(req.body, req.user);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async findAll(req, res, next) {
    try {
      const {
        page = 1, limit = 10, categoryId, statusId, organizerUuid,
      } = req.query;
      const result = await this.eventoService.findAll({
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        categoryId: categoryId ? parseInt(categoryId, 10) : undefined,
        statusId: statusId ? parseInt(statusId, 10) : undefined,
        organizerUuid,
      });
      res.status(200).json({ success: true, data: result.data, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async findById(req, res, next) {
    try {
      const result = await this.eventoService.findById(req.params.id);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const result = await this.eventoService.update(req.params.id, req.body, req.user);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      await this.eventoService.delete(req.params.id, req.user);
      res.status(200).json({ success: true, message: 'Event deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async publish(req, res, next) {
    try {
      const result = await this.eventoService.publish(req.params.id, req.user);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async start(req, res, next) {
    try {
      const result = await this.eventoService.start(req.params.id, req.user);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async complete(req, res, next) {
    try {
      const result = await this.eventoService.complete(req.params.id, req.user);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async cancel(req, res, next) {
    try {
      const result = await this.eventoService.cancel(req.params.id, req.user);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = EventoController;
