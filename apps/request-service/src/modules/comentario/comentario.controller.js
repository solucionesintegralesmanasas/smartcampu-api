class ComentarioController {
  constructor(comentarioService) {
    this.comentarioService = comentarioService;
  }

  async create(req, res, next) {
    try {
      const result = await this.comentarioService.create(req.params.requestId, req.body, req.user);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async findByRequestId(req, res, next) {
    try {
      const result = await this.comentarioService.findByRequestId(req.params.requestId, req.user);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      await this.comentarioService.delete(req.params.id, req.user);
      res.status(200).json({ success: true, message: 'Comment deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ComentarioController;
