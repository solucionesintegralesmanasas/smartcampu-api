const DocenteController = require('../../../src/modules/docente/docente.controller');
const EmpresaController = require('../../../src/modules/empresa/empresa.controller');
const EstudianteController = require('../../../src/modules/estudiante/estudiante.controller');
const FacultadController = require('../../../src/modules/facultad/facultad.controller');
const ProgramaController = require('../../../src/modules/programa/programa.controller');
const TerceroController = require('../../../src/modules/tercero/tercero.controller');

describe('Pruebas Unitarias de Controladores', () => {
  const createMockService = () => ({
    create: jest.fn().mockResolvedValue({ id: 1 }),
    findAll: jest.fn().mockResolvedValue({ data: [{ id: 1 }], pagination: { total: 1 } }),
    findById: jest.fn().mockResolvedValue({ id: 1 }),
    update: jest.fn().mockResolvedValue({ id: 1, updated: true }),
    delete: jest.fn().mockResolvedValue({ success: true }),
    search: jest.fn().mockResolvedValue([{ id: 1 }]),
  });

  const createMockRes = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  });

  const testControllerMethods = (ControllerClass, name) => {
    describe(name, () => {
      let controller;
      let service;
      let res;
      let next;

      beforeEach(() => {
        service = createMockService();
        controller = new ControllerClass(service);
        res = createMockRes();
        next = jest.fn();
      });

      it('create éxito', async () => {
        const req = { body: { nombre: 'Test' } };
        await controller.create(req, res, next);
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
      });

      it('create error pasa a next', async () => {
        service.create.mockRejectedValue(new Error('Fallo'));
        const req = { body: {} };
        await controller.create(req, res, next);
        expect(next).toHaveBeenCalledWith(expect.any(Error));
      });

      it('findAll éxito', async () => {
        const req = { query: { page: '1', limit: '20' } };
        await controller.findAll(req, res, next);
        expect(res.status).toHaveBeenCalledWith(200);
      });

      it('findAll error pasa a next', async () => {
        service.findAll.mockRejectedValue(new Error('Fallo'));
        const req = { query: {} };
        await controller.findAll(req, res, next);
        expect(next).toHaveBeenCalledWith(expect.any(Error));
      });

      it('findById éxito', async () => {
        const req = { params: { id: '1' } };
        await controller.findById(req, res, next);
        expect(res.status).toHaveBeenCalledWith(200);
      });

      it('findById error pasa a next', async () => {
        service.findById.mockRejectedValue(new Error('Fallo'));
        const req = { params: { id: '1' } };
        await controller.findById(req, res, next);
        expect(next).toHaveBeenCalledWith(expect.any(Error));
      });

      it('update éxito', async () => {
        const req = { params: { id: '1' }, body: { nombre: 'Modificado' } };
        await controller.update(req, res, next);
        expect(res.status).toHaveBeenCalledWith(200);
      });

      it('update error pasa a next', async () => {
        service.update.mockRejectedValue(new Error('Fallo'));
        const req = { params: { id: '1' }, body: {} };
        await controller.update(req, res, next);
        expect(next).toHaveBeenCalledWith(expect.any(Error));
      });

      it('delete éxito', async () => {
        const req = { params: { id: '1' } };
        await controller.delete(req, res, next);
        expect(res.status).toHaveBeenCalledWith(200);
      });

      it('delete error pasa a next', async () => {
        service.delete.mockRejectedValue(new Error('Fallo'));
        const req = { params: { id: '1' } };
        await controller.delete(req, res, next);
        expect(next).toHaveBeenCalledWith(expect.any(Error));
      });

      it('search éxito', async () => {
        const req = { query: { search: 'Test', limit: '10' } };
        await controller.search(req, res, next);
        expect(res.status).toHaveBeenCalledWith(200);
      });

      it('search error pasa a next', async () => {
        service.search.mockRejectedValue(new Error('Fallo'));
        const req = { query: {} };
        await controller.search(req, res, next);
        expect(next).toHaveBeenCalledWith(expect.any(Error));
      });
    });
  };

  testControllerMethods(EmpresaController, 'EmpresaController');
  testControllerMethods(TerceroController, 'TerceroController');
  testControllerMethods(FacultadController, 'FacultadController');
  testControllerMethods(ProgramaController, 'ProgramaController');
  testControllerMethods(EstudianteController, 'EstudianteController');
  testControllerMethods(DocenteController, 'DocenteController');
});
