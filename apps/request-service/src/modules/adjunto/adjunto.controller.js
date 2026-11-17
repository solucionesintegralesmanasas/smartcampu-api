class AdjuntoController {
  constructor(adjuntoService) {
    this.adjuntoService = adjuntoService;
  }

  async create(req, res, next) {
    try {
      const result = await this.adjuntoService.create(req.params.requestId, req.body, req.user);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async findByRequestId(req, res, next) {
    try {
      const result = await this.adjuntoService.findByRequestId(req.params.requestId, req.user);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      await this.adjuntoService.delete(req.params.id, req.user);
      res.status(200).json({ success: true, message: 'Attachment removed successfully' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AdjuntoController;
