class SolicitudController {
  constructor(solicitudService) {
    this.solicitudService = solicitudService;
  }

  async create(req, res, next) {
    try {
      const result = await this.solicitudService.create(req.body, req.user);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async findAll(req, res, next) {
    try {
      const {
        page = 1, limit = 10, statusId, assigneeUuid,
      } = req.query;
      const result = await this.solicitudService.findAll(req.user, {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        statusId: statusId ? parseInt(statusId, 10) : undefined,
        assigneeUuid,
      });
      res.status(200).json({ success: true, data: result.data, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async findById(req, res, next) {
    try {
      const result = await this.solicitudService.findById(req.params.id, req.user);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async findHistory(req, res, next) {
    try {
      const result = await this.solicitudService.findHistory(req.params.id, req.user);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async startReview(req, res, next) {
    try {
      const result = await this.solicitudService.startReview(req.params.id, req.user);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async approve(req, res, next) {
    try {
      const result = await this.solicitudService.approve(
        req.params.id,
        req.user,
        req.body.resolutionNotes,
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async reject(req, res, next) {
    try {
      const result = await this.solicitudService.reject(
        req.params.id,
        req.user,
        req.body.resolutionNotes,
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async close(req, res, next) {
    try {
      const result = await this.solicitudService.close(req.params.id, req.user);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = SolicitudController;
