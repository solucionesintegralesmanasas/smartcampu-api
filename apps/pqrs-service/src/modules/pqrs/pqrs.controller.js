class PqrsController {
  constructor(pqrsService) {
    this.pqrsService = pqrsService;
  }

  async create(req, res, next) {
    try {
      const result = await this.pqrsService.create(req.body, req.user);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async findAll(req, res, next) {
    try {
      const {
        page = 1, limit = 10, statusId, typeId, assigneeUuid,
      } = req.query;
      const result = await this.pqrsService.findAll(req.user, {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        statusId: statusId ? parseInt(statusId, 10) : undefined,
        typeId: typeId ? parseInt(typeId, 10) : undefined,
        assigneeUuid,
      });
      res.status(200).json({ success: true, data: result.data, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async findById(req, res, next) {
    try {
      const result = await this.pqrsService.findById(req.params.id, req.user);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async findByTicketNumber(req, res, next) {
    try {
      const result = await this.pqrsService.findByTicketNumber(req.params.ticketNumber);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async findHistory(req, res, next) {
    try {
      const result = await this.pqrsService.findHistory(req.params.id, req.user);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async findResponses(req, res, next) {
    try {
      const result = await this.pqrsService.findResponses(req.params.id, req.user);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async startReview(req, res, next) {
    try {
      const result = await this.pqrsService.startReview(req.params.id, req.user);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async respond(req, res, next) {
    try {
      const result = await this.pqrsService.respond(req.params.id, req.user, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async close(req, res, next) {
    try {
      const result = await this.pqrsService.close(req.params.id, req.user);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = PqrsController;
