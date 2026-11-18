const fs = require('fs');
const path = require('path');

jest.mock('../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../src/config/env', () => {
  const os = require('os');
  const pathModule = require('path');
  return {
    env: {
      NODE_ENV: 'test',
      MAX_FILE_SIZE: 1024 * 1024,
      UPLOAD_DIR: pathModule.join(os.tmpdir(), 'uajs-storage-unit-service'),
      STORAGE_INDEX: 'test_uajs_storage',
    },
  };
});

const { env } = require('../../src/config/env');
const logger = require('../../src/config/logger');
const {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} = require('../../src/core/exceptions');
const ArchivoService = require('../../src/modules/archivo/archivo.service');

const UUID = '550e8400-e29b-41d4-a716-446655440000';

const OWNER = { id: 10, nombre: 'Juan Perez', roles: ['STUDENT'] };
const OTHER_TEACHER = { id: 11, nombre: 'Ana', roles: ['TEACHER'] };
const STAFF = { id: 99, nombre: 'Staff', roles: ['STAFF'] };

const archivoFixture = (overrides = {}) => ({
  id: 1,
  uuid: UUID,
  nombre_original: 'documento.pdf',
  nombre_sistema: 'interno.pdf',
  ruta_acceso: path.join(env.UPLOAD_DIR, 'interno.pdf'),
  mime_type: 'application/pdf',
  peso_bytes: 1024,
  extension: '.pdf',
  entidad_asociada: null,
  uuid_asociado: null,
  subido_por: 10,
  subido_por_nombre: 'Juan Perez',
  carpeta: 'general',
  publico: false,
  activo: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const buildFile = (overrides = {}) => {
  const buffer = Buffer.from('%PDF-1.4 contenido de prueba');
  return {
    originalname: 'documento.pdf',
    mimetype: 'application/pdf',
    size: buffer.length,
    buffer,
    ...overrides,
  };
};

const mockRepository = (overrides = {}) => ({
  create: jest.fn().mockResolvedValue(archivoFixture()),
  findByUuid: jest.fn().mockResolvedValue(archivoFixture()),
  findAll: jest.fn().mockResolvedValue({ files: [archivoFixture()], total: 1 }),
  update: jest.fn().mockResolvedValue(archivoFixture({ carpeta: 'nueva' })),
  delete: jest.fn().mockResolvedValue(true),
  searchInElasticsearch: jest.fn().mockResolvedValue({ total: 1, files: [archivoFixture()] }),
  ...overrides,
});

const mockProducer = (overrides = {}) => ({
  indexFile: jest.fn().mockResolvedValue(undefined),
  updateFileInES: jest.fn().mockResolvedValue(undefined),
  deleteFileFromES: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe('ArchivoService', () => {
  let repo;
  let producer;
  let service;

  beforeAll(() => {
    fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(env.UPLOAD_DIR, { recursive: true, force: true });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    repo = mockRepository();
    producer = mockProducer();
    service = new ArchivoService(repo, producer);
  });

  describe('uploadFile', () => {
    it('guarda el binario en UPLOAD_DIR con nombre UUID y persiste los metadatos', async () => {
      const result = await service.uploadFile(buildFile(), {
        entidadAsociada: 'request',
        uuidAsociado: UUID,
        carpeta: 'documentos',
        publico: true,
      }, OWNER);

      const data = repo.create.mock.calls[0][0];
      expect(data).toEqual(expect.objectContaining({
        nombreOriginal: 'documento.pdf',
        mimeType: 'application/pdf',
        pesoBytes: buildFile().size,
        extension: '.pdf',
        entidadAsociada: 'request',
        uuidAsociado: UUID,
        subidoPor: 10,
        subidoPorNombre: 'Juan Perez',
        carpeta: 'documentos',
        publico: true,
      }));
      expect(data.nombreSistema).toMatch(/^[0-9a-f-]{36}\.pdf$/);
      expect(path.dirname(data.rutaAcceso)).toBe(path.normalize(env.UPLOAD_DIR));
      expect(fs.readFileSync(data.rutaAcceso, 'utf8')).toContain('contenido de prueba');
      expect(result).toEqual(archivoFixture());
    });

    it('usa valores por defecto cuando no hay metadata', async () => {
      await service.uploadFile(buildFile(), {}, OWNER);

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
        entidadAsociada: null,
        uuidAsociado: null,
        carpeta: 'general',
        publico: false,
      }));
    });

    it('encola la indexación en Elasticsearch tras persistir', async () => {
      await service.uploadFile(buildFile(), {}, OWNER);
      expect(producer.indexFile).toHaveBeenCalledWith(archivoFixture());
    });

    it('conserva solo el nombre base del archivo original', async () => {
      await service.uploadFile(buildFile({ originalname: 'carpeta/anidada/archivo.pdf' }), {}, OWNER);
      expect(repo.create.mock.calls[0][0].nombreOriginal).toBe('archivo.pdf');
    });

    it('rechaza extensiones no permitidas sin tocar la base de datos', async () => {
      const file = buildFile({ originalname: 'virus.exe' });
      await expect(service.uploadFile(file, {}, OWNER)).rejects.toThrow(ValidationError);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('rechaza archivos vacíos', async () => {
      const file = buildFile({ size: 0 });
      await expect(service.uploadFile(file, {}, OWNER)).rejects.toThrow('El archivo está vacío');
    });

    it('rechaza archivos que superan MAX_FILE_SIZE', async () => {
      const file = buildFile({ size: env.MAX_FILE_SIZE + 1 });
      await expect(service.uploadFile(file, {}, OWNER)).rejects.toThrow(/tamaño máximo/);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('elimina el binario y propaga el error si falla la persistencia', async () => {
      repo.create.mockRejectedValue(new Error('db caída'));

      await expect(service.uploadFile(buildFile(), {}, OWNER)).rejects.toThrow('db caída');

      const ruta = repo.create.mock.calls[0][0].rutaAcceso;
      expect(fs.existsSync(ruta)).toBe(false);
      expect(producer.indexFile).not.toHaveBeenCalled();
    });

    it('devuelve el archivo aunque no se pueda encolar la indexación', async () => {
      producer.indexFile.mockRejectedValue(new Error('redis caído'));

      const result = await service.uploadFile(buildFile(), {}, OWNER);

      expect(result).toEqual(archivoFixture());
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('encolar'),
        expect.objectContaining({ operacion: 'indexFile' }),
      );
    });
  });

  describe('getFileByUuid (lectura)', () => {
    it('lanza NotFoundError si el UUID no existe', async () => {
      service = new ArchivoService(mockRepository({ findByUuid: jest.fn().mockResolvedValue(null) }), producer);
      await expect(service.getFileByUuid(UUID, OWNER)).rejects.toThrow(NotFoundError);
    });

    it('permite al dueño leer su archivo privado', async () => {
      await expect(service.getFileByUuid(UUID, OWNER)).resolves.toEqual(archivoFixture());
    });

    it('impide a otro usuario leer un archivo privado', async () => {
      await expect(service.getFileByUuid(UUID, OTHER_TEACHER)).rejects.toThrow(ForbiddenError);
    });

    it('permite a ADMIN/STAFF leer cualquier archivo', async () => {
      await expect(service.getFileByUuid(UUID, STAFF)).resolves.toBeDefined();
    });

    it('permite leer un archivo público y activo a cualquier usuario', async () => {
      service = new ArchivoService(
        mockRepository({ findByUuid: jest.fn().mockResolvedValue(archivoFixture({ publico: true })) }),
        producer,
      );
      await expect(service.getFileByUuid(UUID, OTHER_TEACHER)).resolves.toBeDefined();
    });

    it('no expone un archivo público pero inactivo a usuarios sin permisos', async () => {
      service = new ArchivoService(
        mockRepository({
          findByUuid: jest.fn().mockResolvedValue(archivoFixture({ publico: true, activo: false })),
        }),
        producer,
      );
      await expect(service.getFileByUuid(UUID, OTHER_TEACHER)).rejects.toThrow(ForbiddenError);
    });

    it('exige autenticación para archivos privados sin usuario', async () => {
      await expect(service.getFileByUuid(UUID, null)).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('listFiles', () => {
    it('limita el alcance a los archivos del usuario y públicos', async () => {
      await service.listFiles({ page: 2, limit: 10, tipo: 'application/pdf' }, OWNER);

      expect(repo.findAll).toHaveBeenCalledWith({
        page: 2,
        limit: 10,
        tipo: 'application/pdf',
        scope: { usuarioId: 10, puedeVerTodo: false },
      });
    });

    it('no limita el alcance para ADMIN/STAFF', async () => {
      await service.listFiles({ page: 1, limit: 20 }, STAFF);
      expect(repo.findAll).toHaveBeenCalledWith(expect.objectContaining({
        scope: { usuarioId: 99, puedeVerTodo: true },
      }));
    });
  });

  describe('searchFiles', () => {
    it('delega la búsqueda en Elasticsearch con el alcance del usuario', async () => {
      const result = await service.searchFiles({ search: 'contrato', page: 1, limit: 10 }, OWNER);

      expect(repo.searchInElasticsearch).toHaveBeenCalledWith({
        search: 'contrato',
        page: 1,
        limit: 10,
        scope: { usuarioId: 10, puedeVerTodo: false },
      });
      expect(result.total).toBe(1);
    });

    it('degrada a MySQL si Elasticsearch falla', async () => {
      repo.searchInElasticsearch.mockRejectedValue(new Error('ES down'));

      const result = await service.searchFiles({ search: 'contrato', page: 1, limit: 10 }, OWNER);

      expect(repo.findAll).toHaveBeenCalledWith(expect.objectContaining({
        search: 'contrato',
        scope: { usuarioId: 10, puedeVerTodo: false },
      }));
      expect(result.files).toHaveLength(1);
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('updateFile', () => {
    it('actualiza los metadatos del dueño y encola la sincronización', async () => {
      const result = await service.updateFile(UUID, { carpeta: 'nueva' }, OWNER);

      expect(repo.update).toHaveBeenCalledWith(1, { carpeta: 'nueva' });
      expect(producer.updateFileInES).toHaveBeenCalledWith(expect.objectContaining({
        uuid: UUID,
        carpeta: 'nueva',
      }));
      expect(result.carpeta).toBe('nueva');
    });

    it('impide modificar archivos de otro usuario', async () => {
      await expect(service.updateFile(UUID, { carpeta: 'x' }, OTHER_TEACHER))
        .rejects.toThrow(ForbiddenError);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('lanza NotFoundError si el archivo no existe', async () => {
      service = new ArchivoService(mockRepository({ findByUuid: jest.fn().mockResolvedValue(null) }), producer);
      await expect(service.updateFile(UUID, { carpeta: 'x' }, OWNER)).rejects.toThrow(NotFoundError);
    });

    it('lanza NotFoundError si el registro desaparece durante la actualización', async () => {
      repo.update.mockResolvedValue(null);
      await expect(service.updateFile(UUID, { carpeta: 'x' }, OWNER)).rejects.toThrow(NotFoundError);
    });

    it('no falla si no se puede encolar la sincronización', async () => {
      producer.updateFileInES.mockRejectedValue(new Error('redis caído'));
      await expect(service.updateFile(UUID, { carpeta: 'x' }, OWNER)).resolves.toBeDefined();
    });
  });

  describe('deleteFile', () => {
    it('aplica soft delete y encola la eliminación del índice', async () => {
      const result = await service.deleteFile(UUID, OWNER);

      expect(repo.delete).toHaveBeenCalledWith(1);
      expect(producer.deleteFileFromES).toHaveBeenCalledWith(UUID);
      expect(result).toEqual({ uuid: UUID });
    });

    it('impide eliminar archivos de otro usuario', async () => {
      await expect(service.deleteFile(UUID, OTHER_TEACHER)).rejects.toThrow(ForbiddenError);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('lanza NotFoundError si el repositorio no encuentra el registro', async () => {
      repo.delete.mockResolvedValue(false);
      await expect(service.deleteFile(UUID, OWNER)).rejects.toThrow(NotFoundError);
    });

    it('permite a STAFF eliminar cualquier archivo', async () => {
      await expect(service.deleteFile(UUID, STAFF)).resolves.toEqual({ uuid: UUID });
    });
  });

  describe('getDownload', () => {
    const rutaDescarga = () => {
      const ruta = path.join(env.UPLOAD_DIR, 'descarga.pdf');
      fs.writeFileSync(ruta, 'pdf');
      return ruta;
    };

    it('devuelve la ruta física para un archivo público', async () => {
      const ruta = rutaDescarga();
      service = new ArchivoService(
        mockRepository({
          findByUuid: jest.fn().mockResolvedValue(archivoFixture({ publico: true, ruta_acceso: ruta })),
        }),
        producer,
      );

      const result = await service.getDownload(UUID, null);

      expect(result).toEqual({
        ruta: path.resolve(ruta),
        nombre: 'documento.pdf',
        mimeType: 'application/pdf',
      });
    });

    it('exige autenticación para descargar un archivo privado sin token', async () => {
      await expect(service.getDownload(UUID, null)).rejects.toThrow(UnauthorizedError);
    });

    it('permite descargar al dueño', async () => {
      service = new ArchivoService(
        mockRepository({
          findByUuid: jest.fn().mockResolvedValue(archivoFixture({ ruta_acceso: rutaDescarga() })),
        }),
        producer,
      );
      await expect(service.getDownload(UUID, OWNER)).resolves.toBeDefined();
    });

    it('lanza NotFoundError si el binario no existe en disco', async () => {
      service = new ArchivoService(
        mockRepository({
          findByUuid: jest.fn().mockResolvedValue(archivoFixture({
            ruta_acceso: path.join(env.UPLOAD_DIR, 'no-existe.pdf'),
          })),
        }),
        producer,
      );
      await expect(service.getDownload(UUID, OWNER)).rejects.toThrow(
        'El archivo físico no está disponible',
      );
    });
  });
});
