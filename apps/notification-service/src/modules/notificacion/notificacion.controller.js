class NotificacionController {
  constructor(notificacionService) {
    this.notificacionService = notificacionService;
  }

  async create(req, res, next) {
    try {
      const result = await this.notificacionService.create(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async findMine(req, res, next) {
    try {
      const {
        page = 1, limit = 10, status, channel,
      } = req.query;
      const result = await this.notificacionService.findMine(req.user, {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        status,
        channel,
      });
      res.status(200).json({ success: true, data: result.data, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async countUnread(req, res, next) {
    try {
      const result = await this.notificacionService.countUnread(req.user);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async markRead(req, res, next) {
    try {
      const result = await this.notificacionService.markRead(req.params.id, req.user);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async markAllRead(req, res, next) {
    try {
      const result = await this.notificacionService.markAllRead(req.user);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = NotificacionController;
