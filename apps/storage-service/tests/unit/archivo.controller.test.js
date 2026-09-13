jest.mock('../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const ArchivoController = require('../../src/modules/archivo/archivo.controller');

const archivoFixture = {
  id: 1,
  uuid: '550e8400-e29b-41d4-a716-446655440000',
  nombre_original: 'documento.pdf',
};

function mockService(overrides = {}) {
  return {
    uploadFile: jest.fn().mockResolvedValue(archivoFixture),
    getFileById: jest.fn().mockResolvedValue(archivoFixture),
    getFileByUuid: jest.fn().mockResolvedValue(archivoFixture),
    listFiles: jest.fn().mockResolvedValue({ files: [archivoFixture], total: 1 }),
    updateFile: jest.fn().mockResolvedValue(archivoFixture),
    deleteFile: jest.fn().mockResolvedValue({ success: true }),
    searchFiles: jest.fn().mockResolvedValue({ total: 1, files: [archivoFixture] }),
    ...overrides,
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('ArchivoController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadFile', () => {
    it('retorna 201 con el archivo creado', async () => {
      const service = mockService();
      const controller = new ArchivoController(service);
      const req = { file: { originalname: 'a.pdf' }, body: { carpeta: 'docs' }, user: {} };
      const res = mockRes();
      const next = jest.fn();

      await controller.uploadFile(req, res, next);

      expect(service.uploadFile).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: archivoFixture });
    });

    it('retorna 400 si no hay archivo', async () => {
      const controller = new ArchivoController(mockService());
      const res = mockRes();

      await controller.uploadFile({ file: undefined, body: {} }, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false }),
      );
    });

    it('llama next ante error del servicio', async () => {
      const service = mockService({ uploadFile: jest.fn().mockRejectedValue(new Error('fail')) });
      const controller = new ArchivoController(service);
      const next = jest.fn();

      await controller.uploadFile({ file: {}, body: {} }, mockRes(), next);

      expect(next).toHaveBeenCalled();
    });

    it('mapea publico string a booleano y usuario desde req.user', async () => {
      const service = mockService();
      const controller = new ArchivoController(service);
      const req = {
        file: { originalname: 'a.pdf' },
        body: { publico: 'true' },
        user: { id: 7, nombre: 'Ana' },
      };

      await controller.uploadFile(req, mockRes(), jest.fn());

      expect(service.uploadFile).toHaveBeenCalledWith(
        req.file,
        expect.objectContaining({ usuarioId: 7, usuarioNombre: 'Ana', publico: true }),
      );
    });
  });

  describe('getFileById / getFileByUuid', () => {
    it('retorna 200 por ID', async () => {
      const controller = new ArchivoController(mockService());
      const res = mockRes();

      await controller.getFileById({ params: { id: '1' } }, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('retorna 200 por UUID', async () => {
      const controller = new ArchivoController(mockService());
      const res = mockRes();

      await controller.getFileByUuid({ params: { uuid: archivoFixture.uuid } }, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('propaga errores con next', async () => {
      const service = mockService({ getFileById: jest.fn().mockRejectedValue(new Error('x')) });
      const controller = new ArchivoController(service);
      const next = jest.fn();

      await controller.getFileById({ params: { id: '1' } }, mockRes(), next);
      expect(next).toHaveBeenCalled();

      const next2 = jest.fn();
      const service2 = mockService({ getFileByUuid: jest.fn().mockRejectedValue(new Error('x')) });
      await new ArchivoController(service2).getFileByUuid(
        { params: { uuid: 'u' } },
        mockRes(),
        next2,
      );
      expect(next2).toHaveBeenCalled();
    });
  });

  describe('listFiles', () => {
    it('retorna lista paginada con metadatos', async () => {
      const controller = new ArchivoController(mockService());
      const res = mockRes();
      const req = { query: { page: '1', limit: '20' } };

      await controller.listFiles(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: [archivoFixture],
          meta: expect.objectContaining({
            pagination: expect.objectContaining({ total: 1, page: 1, limit: 20 }),
          }),
        }),
      );
    });

    it('propaga errores con next', async () => {
      const service = mockService({ listFiles: jest.fn().mockRejectedValue(new Error('db')) });
      const next = jest.fn();
      await new ArchivoController(service).listFiles({ query: {} }, mockRes(), next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('updateFile / deleteFile', () => {
    it('actualiza metadata y retorna 200', async () => {
      const service = mockService();
      const controller = new ArchivoController(service);
      const res = mockRes();

      await controller.updateFile({ params: { id: '1' }, body: { carpeta: 'nueva' } }, res, jest.fn());

      expect(service.updateFile).toHaveBeenCalledWith(1, expect.objectContaining({ carpeta: 'nueva' }));
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('elimina y retorna 200', async () => {
      const service = mockService();
      const controller = new ArchivoController(service);
      const res = mockRes();

      await controller.deleteFile({ params: { id: '1' } }, res, jest.fn());

      expect(service.deleteFile).toHaveBeenCalledWith(1);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('propaga errores de update y delete', async () => {
      const next = jest.fn();
      await new ArchivoController(
        mockService({ updateFile: jest.fn().mockRejectedValue(new Error('e')) }),
      ).updateFile({ params: { id: '1' }, body: {} }, mockRes(), next);
      expect(next).toHaveBeenCalled();

      const next2 = jest.fn();
      await new ArchivoController(
        mockService({ deleteFile: jest.fn().mockRejectedValue(new Error('e')) }),
      ).deleteFile({ params: { id: '1' } }, mockRes(), next2);
      expect(next2).toHaveBeenCalled();
    });
  });

  describe('searchFiles', () => {
    it('retorna 400 si falta término de búsqueda', async () => {
      const controller = new ArchivoController(mockService());
      const res = mockRes();

      await controller.searchFiles({ query: {} }, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('retorna resultados de ES con paginación offset/limit', async () => {
      const service = mockService();
      const controller = new ArchivoController(service);
      const res = mockRes();

      await controller.searchFiles({ query: { q: 'contrato', limit: '10' } }, res, jest.fn());

      expect(service.searchFiles).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'contrato' }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: [archivoFixture] }),
      );
    });

    it('propaga errores con next', async () => {
      const service = mockService({ searchFiles: jest.fn().mockRejectedValue(new Error('es')) });
      const next = jest.fn();
      await new ArchivoController(service).searchFiles({ query: { q: 'a' } }, mockRes(), next);
      expect(next).toHaveBeenCalled();
    });
  });
});
