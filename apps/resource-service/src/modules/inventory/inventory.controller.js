class InventoryController {
  /**
   * @param {import('./inventory.service')} inventoryService
   */
  constructor(inventoryService) {
    this.inventoryService = inventoryService;
  }

  async findAll(req, res, next) {
    try {
      const result = await this.inventoryService.findAll(req.params.id, req.query);
      res.status(200).json({ success: true, data: result.data, meta: result.meta });
    } catch (error) {
      next(error);
    }
  }

  async findOne(req, res, next) {
    try {
      const data = await this.inventoryService.findOne(req.params.id, req.params.itemId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const data = await this.inventoryService.create(req.params.id, req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const data = await this.inventoryService.update(req.params.id, req.params.itemId, req.body);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async remove(req, res, next) {
    try {
      await this.inventoryService.remove(req.params.id, req.params.itemId);
      res.status(200).json({ success: true, message: 'Elemento de inventario desactivado' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = InventoryController;
