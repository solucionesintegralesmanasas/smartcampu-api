class PreferenciaController {
  constructor(preferenciaService) {
    this.preferenciaService = preferenciaService;
  }

  async findMine(req, res, next) {
    try {
      const result = await this.preferenciaService.findMine(req.user);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async setMine(req, res, next) {
    try {
      const result = await this.preferenciaService.setMine(req.user, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = PreferenciaController;
