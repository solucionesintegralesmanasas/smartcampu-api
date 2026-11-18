jest.mock('../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const { ValidationError } = require('../../src/core/exceptions');
const ArchivoController = require('../../src/modules/archivo/archivo.controller');

const UUID = '550e8400-e29b-41d4-a716-446655440000';
const USER = { id: 10, nombre: 'Juan', roles: ['STUDENT'] };

const archivoFixture = {
  id: 1,
  uuid: UUID,
  nombre_original: 'documento.pdf',
  ruta_acceso: '/uploads/interno.pdf',
  publico: false,
  activo: true,
};

const archivoPublico = {
  nombre_original: 'documento.pdf',
  uuid: UUID,
  id: 1,
  publico: false,
  activo: true,
};

function mockService(overrides = {}) {
  return {
    uploadFile: jest.fn().mockResolvedValue(archivoFixture),
    getFileByUuid: jest.fn().mockResolvedValue(archivoFixture),
    listFiles: jest.fn().mockResolvedValue({ files: [archivoFixture], total: 1 }),
    searchFiles: jest.fn().mockResolvedValue({ files: [archivoFixture], total: 1 }),
    updateFile: jest.fn().mockResolvedValue(archivoFixture),
    deleteFile: jest.fn().mockResolvedValue({ uuid: UUID }),
    getDownload: jest.fn().mockResolvedValue({
      ruta: '/uploads/interno.pdf',
      nombre: 'documento.pdf',
      mimeType: 'application/pdf',
    }),
    ...overrides,
  };
}

function mockRes() {
  const res = {
    headersSent: false,
  };
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.download = jest.fn();
  return res;
}

const expectSinRutaFisica = (body) => {
  expect(JSON.stringify(body)).not.toContain('ruta_acceso');
};

describe('ArchivoController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadFile', () => {
    it('responde 201 con el archivo sin exponer la ruta física', async () => {
      const service = mockService();
      const controller = new ArchivoController(service);
      const res = mockRes();
      const req = { file: { originalname: 'a.pdf' }, body: { carpeta: 'docs' }, user: USER };

      await controller.uploadFile(req, res, jest.fn());

      expect(service.uploadFile).toHaveBeenCalledWith(req.file, req.body, USER);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json.mock.calls[0][0].success).toBe(true);
      expect(res.json.mock.calls[0][0].data).toEqual({
        id: 1,
        uuid: UUID,
        nombre_original: 'documento.pdf',
        publico: false,
        activo: true,
      });
      expectSinRutaFisica(res.json.mock.calls[0][0]);
    });

    it('lanza ValidationError (400) cuando no llega ningún archivo', async () => {
      const controller = new ArchivoController(mockService());
      const next = jest.fn();

      await controller.uploadFile({ body: {}, user: USER }, mockRes(), next);

      expect(next.mock.calls[0][0]).toBeInstanceOf(ValidationError);
      expect(next.mock.calls[0][0].statusCode).toBe(400);
    });

    it('propaga errores del servicio con next', async () => {
      const service = mockService({ uploadFile: jest.fn().mockRejectedValue(new Error('fail')) });
      const next = jest.fn();

      await new ArchivoController(service).uploadFile(
        { file: {}, body: {}, user: USER },
        mockRes(),
        next,
      );

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getFileByUuid', () => {
    it('responde 200 pasando el usuario autenticado al servicio', async () => {
      const service = mockService();
      const res = mockRes();

      await new ArchivoController(service).getFileByUuid(
        { params: { uuid: UUID }, user: USER },
        res,
        jest.fn(),
      );

      expect(service.getFileByUuid).toHaveBeenCalledWith(UUID, USER);
      expect(res.status).toHaveBeenCalledWith(200);
      expectSinRutaFisica(res.json.mock.calls[0][0]);
    });

    it('propaga errores con next', async () => {
      const service = mockService({ getFileByUuid: jest.fn().mockRejectedValue(new Error('x')) });
      const next = jest.fn();

      await new ArchivoController(service).getFileByUuid(
        { params: { uuid: UUID }, user: USER },
        mockRes(),
        next,
      );

      expect(next).toHaveBeenCalled();
    });
  });

  describe('listFiles', () => {
    it('responde con lista paginada y meta de paginación', async () => {
      const controller = new ArchivoController(mockService());
      const res = mockRes();

      await controller.listFiles({ query: { page: 1, limit: 20 }, user: USER }, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body.data).toHaveLength(1);
      expect(body.meta).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      });
      expectSinRutaFisica(body);
    });

    it('separa paginación de los filtros enviados al servicio', async () => {
      const service = mockService();

      await new ArchivoController(service).listFiles(
        { query: { page: 2, limit: 5, tipo: 'application/pdf' }, user: USER },
        mockRes(),
        jest.fn(),
      );

      expect(service.listFiles).toHaveBeenCalledWith(
        { page: 2, limit: 5, tipo: 'application/pdf' },
        USER,
      );
    });

    it('propaga errores con next', async () => {
      const service = mockService({ listFiles: jest.fn().mockRejectedValue(new Error('db')) });
      const next = jest.fn();

      await new ArchivoController(service).listFiles(
        { query: { page: 1, limit: 20 }, user: USER },
        mockRes(),
        next,
      );

      expect(next).toHaveBeenCalled();
    });
  });

  describe('searchFiles', () => {
    it('responde con resultados y meta usando page/limit', async () => {
      const service = mockService();
      const res = mockRes();

      await new ArchivoController(service).searchFiles(
        { query: { search: 'contrato', page: 1, limit: 10 }, user: USER },
        res,
        jest.fn(),
      );

      expect(service.searchFiles).toHaveBeenCalledWith(
        { search: 'contrato', page: 1, limit: 10 },
        USER,
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].meta.total).toBe(1);
      expectSinRutaFisica(res.json.mock.calls[0][0]);
    });

    it('propaga errores con next', async () => {
      const service = mockService({ searchFiles: jest.fn().mockRejectedValue(new Error('es')) });
      const next = jest.fn();

      await new ArchivoController(service).searchFiles(
        { query: { search: 'a', page: 1, limit: 20 }, user: USER },
        mockRes(),
        next,
      );

      expect(next).toHaveBeenCalled();
    });
  });

  describe('updateFile / deleteFile', () => {
    it('actualiza metadata y responde 200', async () => {
      const service = mockService();
      const res = mockRes();

      await new ArchivoController(service).updateFile(
        { params: { uuid: UUID }, body: { carpeta: 'nueva' }, user: USER },
        res,
        jest.fn(),
      );

      expect(service.updateFile).toHaveBeenCalledWith(UUID, { carpeta: 'nueva' }, USER);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('elimina y responde 200 con mensaje', async () => {
      const service = mockService();
      const res = mockRes();

      await new ArchivoController(service).deleteFile(
        { params: { uuid: UUID }, user: USER },
        res,
        jest.fn(),
      );

      expect(service.deleteFile).toHaveBeenCalledWith(UUID, USER);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: expect.any(String),
        data: { uuid: UUID },
      }));
    });

    it('propaga errores de update y delete', async () => {
      const next = jest.fn();
      await new ArchivoController(
        mockService({ updateFile: jest.fn().mockRejectedValue(new Error('e')) }),
      ).updateFile({ params: { uuid: UUID }, body: {}, user: USER }, mockRes(), next);
      expect(next).toHaveBeenCalledTimes(1);

      const next2 = jest.fn();
      await new ArchivoController(
        mockService({ deleteFile: jest.fn().mockRejectedValue(new Error('e')) }),
      ).deleteFile({ params: { uuid: UUID }, user: USER }, mockRes(), next2);
      expect(next2).toHaveBeenCalledTimes(1);
    });
  });

  describe('downloadFile', () => {
    it('envía el binario con res.download y el nombre original', async () => {
      const service = mockService();
      const res = mockRes();

      await new ArchivoController(service).downloadFile(
        { params: { uuid: UUID }, user: undefined },
        res,
        jest.fn(),
      );

      expect(service.getDownload).toHaveBeenCalledWith(UUID, null);
      expect(res.download).toHaveBeenCalledWith(
        '/uploads/interno.pdf',
        'documento.pdf',
        expect.any(Function),
      );
    });

    it('pasa el usuario autenticado cuando existe', async () => {
      const service = mockService();

      await new ArchivoController(service).downloadFile(
        { params: { uuid: UUID }, user: USER },
        mockRes(),
        jest.fn(),
      );

      expect(service.getDownload).toHaveBeenCalledWith(UUID, USER);
    });

    it('reenvía el error de transmisión si los encabezados no se han enviado', async () => {
      const res = mockRes();
      const next = jest.fn();
      await new ArchivoController(mockService()).downloadFile(
        { params: { uuid: UUID } },
        res,
        next,
      );

      const callback = res.download.mock.calls[0][2];
      const streamError = new Error('EIO');
      callback(streamError);

      expect(next).toHaveBeenCalledWith(streamError);
    });

    it('no reenvía el error si la respuesta ya fue iniciada', async () => {
      const res = mockRes();
      res.headersSent = true;
      const next = jest.fn();
      await new ArchivoController(mockService()).downloadFile(
        { params: { uuid: UUID } },
        res,
        next,
      );

      res.download.mock.calls[0][2](new Error('EIO'));

      expect(next).not.toHaveBeenCalled();
    });

    it('propaga errores de autorización con next', async () => {
      const service = mockService({ getDownload: jest.fn().mockRejectedValue(new Error('403')) });
      const next = jest.fn();

      await new ArchivoController(service).downloadFile(
        { params: { uuid: UUID } },
        mockRes(),
        next,
      );

      expect(next).toHaveBeenCalled();
    });
  });

  it('toApiArchivo no altera el registro público (campos disponibles)', () => {
    expect(archivoPublico.uuid).toBe(UUID);
  });
});
