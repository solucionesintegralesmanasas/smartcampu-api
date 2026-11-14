const CampusController = require('../../src/modules/campus/campus.controller');
const CityController = require('../../src/modules/city/city.controller');
const CountryController = require('../../src/modules/country/country.controller');
const DepartmentController = require('../../src/modules/department/department.controller');
const DocumentTypeController = require('../../src/modules/document-type/document-type.controller');

const paginated = {
  data: [{ id: 1, name: 'Antioquia' }],
  pagination: {
    page: 1, limit: 10, total: 1, totalPages: 1,
  },
};

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

  describe('CountryController', () => {
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
      controller = new CountryController(mockService);
    });

    it('create debe responder 201 con el país creado', async () => {
      const req = { body: { isoCode: 'CO', name: 'Colombia' } };
      mockService.create.mockResolvedValue({ id: 1, ...req.body });

      await controller.create(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { id: 1, isoCode: 'CO', name: 'Colombia' },
      });
    });

    it('findAll debe responder con data y meta', async () => {
      const req = { query: { page: '1', limit: '10' } };
      mockService.findAll.mockResolvedValue(paginated);

      await controller.findAll(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: paginated.data,
        meta: paginated.pagination,
      });
    });

    it('findAll debe limitar el tamaño de página a 100', async () => {
      const req = { query: { page: '2', limit: '500' } };
      mockService.findAll.mockResolvedValue(paginated);

      await controller.findAll(req, mockRes, mockNext);

      expect(mockService.findAll).toHaveBeenCalledWith({ page: 2, limit: 100 });
    });

    it('findAll debe usar valores por defecto si no se envían parámetros', async () => {
      mockService.findAll.mockResolvedValue(paginated);

      await controller.findAll({ query: {} }, mockRes, mockNext);

      expect(mockService.findAll).toHaveBeenCalledWith({ page: 1, limit: 10 });
    });

    it('findById debe responder 200 con el elemento', async () => {
      mockService.findById.mockResolvedValue({ id: 1, name: 'Colombia' });

      await controller.findById({ params: { id: '1' } }, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: { id: 1, name: 'Colombia' } });
    });

    it('update debe responder 200 con el elemento actualizado', async () => {
      mockService.update.mockResolvedValue({ id: 1, name: 'Colombia Continental' });

      await controller.update(
        { params: { id: '1' }, body: { name: 'Colombia Continental' } },
        mockRes,
        mockNext,
      );

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('delete debe responder 200 con mensaje de éxito', async () => {
      mockService.delete.mockResolvedValue();

      await controller.delete({ params: { id: '1' } }, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'País eliminado correctamente',
      });
    });

    it('search debe responder 200 con los resultados', async () => {
      mockService.search.mockResolvedValue([{ id: 1, name: 'Colombia' }]);

      await controller.search({ query: { search: 'Colo' } }, mockRes, mockNext);

      expect(mockService.search).toHaveBeenCalledWith('Colo');
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: [{ id: 1, name: 'Colombia' }],
      });
    });

    it('debe pasar los errores a next', async () => {
      const err = new Error('Fallo de base de datos');
      mockService.findById.mockRejectedValue(err);

      await controller.findById({ params: { id: '1' } }, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(err);
    });
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
      const req = { body: { name: 'Antioquia', countryId: 1 } };
      mockService.create.mockResolvedValue({ id: 1, name: 'Antioquia' });

      await controller.create(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { id: 1, name: 'Antioquia' },
      });
    });

    it('findAll debe responder 200 con data y meta', async () => {
      const req = { query: { page: '1', limit: '10' } };
      mockService.findAll.mockResolvedValue(paginated);

      await controller.findAll(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: paginated.data,
        meta: paginated.pagination,
      });
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
      mockService.delete.mockResolvedValue();

      await controller.delete({ params: { id: '1' } }, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Departamento eliminado correctamente',
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

    it('debe capturar error y pasarlo a next', async () => {
      const err = new Error('Database error');
      mockService.create.mockRejectedValue(err);

      await controller.create({ body: {} }, mockRes, mockNext);

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

    it('create debe responder 201', async () => {
      mockService.create.mockResolvedValue({ id: 1, name: 'Medellín' });

      await controller.create({ body: { name: 'Medellín', stateId: 1 } }, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    it('findAll debe responder con data y meta', async () => {
      mockService.findAll.mockResolvedValue(paginated);

      await controller.findAll({ query: {} }, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: paginated.data,
        meta: paginated.pagination,
      });
    });

    it('findById debe responder 200 con el elemento', async () => {
      mockService.findById.mockResolvedValue({ id: 1, name: 'Medellín' });

      await controller.findById({ params: { id: '1' } }, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('update debe responder 200', async () => {
      mockService.update.mockResolvedValue({ id: 1 });

      await controller.update({ params: { id: '1' }, body: { name: 'X' } }, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('delete debe responder 200 con mensaje de éxito', async () => {
      mockService.delete.mockResolvedValue();

      await controller.delete({ params: { id: '1' } }, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Ciudad eliminada correctamente',
      });
    });

    it('search debe responder 200 con los resultados', async () => {
      mockService.search.mockResolvedValue([]);

      await controller.search({ query: { search: 'Med' } }, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: [] });
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

    it('create debe responder 201', async () => {
      mockService.create.mockResolvedValue({ id: 1 });

      await controller.create({ body: { name: 'Campus Robledo', cityId: 1 } }, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    it('findAll debe responder con data y meta', async () => {
      mockService.findAll.mockResolvedValue(paginated);

      await controller.findAll({ query: { page: '1', limit: '10' } }, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: paginated.data,
        meta: paginated.pagination,
      });
    });

    it('findById debe responder 200', async () => {
      mockService.findById.mockResolvedValue({ id: 1 });

      await controller.findById({ params: { id: '1' } }, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('update debe responder 200', async () => {
      mockService.update.mockResolvedValue({ id: 1 });

      await controller.update({ params: { id: '1' }, body: {} }, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('delete debe responder 200 con mensaje de éxito', async () => {
      mockService.delete.mockResolvedValue();

      await controller.delete({ params: { id: '1' } }, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Sede eliminada correctamente',
      });
    });

    it('search debe responder 200', async () => {
      mockService.search.mockResolvedValue([]);

      await controller.search({ query: {} }, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: [] });
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

    it('findAll debe responder con data y meta', async () => {
      mockService.findAll.mockResolvedValue(paginated);

      await controller.findAll({ query: {} }, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: paginated.data,
        meta: paginated.pagination,
      });
    });

    it('findById debe responder 200', async () => {
      mockService.findById.mockResolvedValue({ id: 1 });

      await controller.findById({ params: { id: '1' } }, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('update debe responder 200', async () => {
      mockService.update.mockResolvedValue({ id: 1 });

      await controller.update({ params: { id: '1' }, body: {} }, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('delete debe responder 200 con mensaje de éxito', async () => {
      mockService.delete.mockResolvedValue();

      await controller.delete({ params: { id: '1' } }, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Tipo de documento eliminado correctamente',
      });
    });

    it('search debe responder 200', async () => {
      mockService.search.mockResolvedValue([]);

      await controller.search({ query: { search: 'CC' } }, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: [] });
    });
  });
});
