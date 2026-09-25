const CampusController = require('../../src/modules/campus/campus.controller');
const CityController = require('../../src/modules/city/city.controller');
const DepartmentController = require('../../src/modules/department/department.controller');
const DocumentTypeController = require('../../src/modules/document-type/document-type.controller');

describe('Catalog Controllers (Unit Tests)', () => {
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('DepartmentController', () => {
    let mockService;
    let controller;

    beforeEach(() => {
      mockService = {
        create: jest.fn(),
        findAll: jest.fn(),
        findById: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        search: jest.fn(),
      };
      controller = new DepartmentController(mockService);
    });

    it('create debe responder 201 con data', async () => {
      const req = { body: { name: 'Antioquia' } };
      mockService.create.mockResolvedValue({ id: 1, name: 'Antioquia' });

      await controller.create(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { id: 1, name: 'Antioquia' },
      });
    });

    it('findAll debe responder 200 con paginación', async () => {
      const req = { query: { page: '1', limit: '10' } };
      mockService.findAll.mockResolvedValue({
        data: [{ id: 1, name: 'Antioquia' }],
        pagination: {
          page: 1, limit: 10, total: 1, totalPages: 1,
        },
      });

      await controller.findAll(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: expect.any(Array) }),
      );
    });

    it('findById debe responder 200 con el elemento', async () => {
      const req = { params: { id: '1' } };
      mockService.findById.mockResolvedValue({ id: 1, name: 'Antioquia' });

      await controller.findById(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { id: 1, name: 'Antioquia' },
      });
    });

    it('update debe responder 200 con el elemento actualizado', async () => {
      const req = { params: { id: '1' }, body: { name: 'Antioquia Modificado' } };
      mockService.update.mockResolvedValue({ id: 1, name: 'Antioquia Modificado' });

      await controller.update(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('delete debe responder 200 con mensaje de éxito', async () => {
      const req = { params: { id: '1' } };
      mockService.delete.mockResolvedValue(true);

      await controller.delete(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Department deleted successfully',
      });
    });

    it('search debe responder 200 con los resultados', async () => {
      const req = { query: { search: 'Anti' } };
      mockService.search.mockResolvedValue([{ id: 1, name: 'Antioquia' }]);

      await controller.search(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: [{ id: 1, name: 'Antioquia' }],
      });
    });

    it('debe capturar error y pasar a next', async () => {
      const req = { body: {} };
      const err = new Error('Database error');
      mockService.create.mockRejectedValue(err);

      await controller.create(req, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(err);
    });
  });

  describe('CityController', () => {
    let mockService;
    let controller;

    beforeEach(() => {
      mockService = {
        create: jest.fn(),
        findAll: jest.fn(),
        findById: jest.fn(),
        findByStateId: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        search: jest.fn(),
      };
      controller = new CityController(mockService);
    });

    it('findByStateId debe responder 200 con las ciudades del departamento', async () => {
      const req = { params: { stateId: '1' } };
      mockService.findByStateId.mockResolvedValue([{ id: 1, name: 'Medellín', stateId: 1 }]);

      await controller.findByStateId(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: [{ id: 1, name: 'Medellín', stateId: 1 }],
      });
    });
  });

  describe('CampusController', () => {
    let mockService;
    let controller;

    beforeEach(() => {
      mockService = {
        create: jest.fn(),
        findAll: jest.fn(),
        findById: jest.fn(),
        findByCityId: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        search: jest.fn(),
      };
      controller = new CampusController(mockService);
    });

    it('findByCityId debe responder 200 con sedes por ciudad', async () => {
      const req = { params: { cityId: '1' } };
      mockService.findByCityId.mockResolvedValue([{ id: 1, name: 'Campus Robledo', cityId: 1 }]);

      await controller.findByCityId(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: [{ id: 1, name: 'Campus Robledo', cityId: 1 }],
      });
    });
  });

  describe('DocumentTypeController', () => {
    let mockService;
    let controller;

    beforeEach(() => {
      mockService = {
        create: jest.fn(),
        findAll: jest.fn(),
        findById: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        search: jest.fn(),
      };
      controller = new DocumentTypeController(mockService);
    });

    it('create debe responder 201 con el nuevo tipo de documento', async () => {
      const req = { body: { name: 'Cédula', code: 'CC' } };
      mockService.create.mockResolvedValue({ id: 1, name: 'Cédula', code: 'CC' });

      await controller.create(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { id: 1, name: 'Cédula', code: 'CC' },
      });
    });
  });
});
