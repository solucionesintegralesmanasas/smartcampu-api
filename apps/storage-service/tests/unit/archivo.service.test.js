jest.mock('../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../src/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    PORT: 3011,
    MYSQL_HOST: 'localhost',
    MYSQL_PORT: 3306,
    MYSQL_USER: 'test',
    MYSQL_PASSWORD: 'test',
    MYSQL_DATABASE: 'test_storage_db',
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    ELASTICSEARCH_HOST: 'localhost',
    ELASTICSEARCH_PORT: 9200,
    STORAGE_QUEUE: 'test_storage_jobs',
    STORAGE_INDEX: 'test_uajs_storage',
    MAX_FILE_SIZE: 10485760,
    UPLOAD_DIR: '/tmp/uploads-test',
  },
}));

jest.mock('../../src/config/elasticsearch', () => ({
  esClient: {
    index: jest.fn(),
    search: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    bulk: jest.fn(),
    client: {
      indices: {
        exists: jest.fn(),
        create: jest.fn(),
      },
    },
  },
  ensureStorageIndex: jest.fn(),
}));

const { esClient } = require('../../src/config/elasticsearch');
const { NotFoundError } = require('../../src/core/exceptions');
const {
  ArchivoService,
  fileFilter,
  ALLOWED_EXTENSIONS,
  upload,
} = require('../../src/modules/archivo/archivo.service');

const archivoFixture = {
  id: 1,
  uuid: '550e8400-e29b-41d4-a716-446655440000',
  nombre_original: 'documento.pdf',
  nombre_sistema: 'uuid-generado.pdf',
  ruta_acceso: '/tmp/uploads-test/uuid-generado.pdf',
  mime_type: 'application/pdf',
  peso_bytes: 1024,
  entidad_asociada: 'evento',
  uuid_asociado: '660e8400-e29b-41d4-a716-446655440001',
  subido_por: 10,
  subido_por_nombre: 'Juan Perez',
  extension: '.pdf',
  carpeta: 'documentos',
  publico: 0,
  activo: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function mockRepository(overrides = {}) {
  return {
    create: jest.fn().mockResolvedValue(archivoFixture),
    findById: jest.fn().mockResolvedValue(archivoFixture),
    findByUuid: jest.fn().mockResolvedValue(archivoFixture),
    findAll: jest.fn().mockResolvedValue({ files: [archivoFixture], total: 1 }),
    update: jest.fn().mockResolvedValue(archivoFixture),
    delete: jest.fn().mockResolvedValue({ success: true }),
    searchInElasticsearch: jest.fn().mockResolvedValue({ total: 1, files: [archivoFixture] }),
    ...overrides,
  };
}

function mockFile(overrides = {}) {
  return {
    originalname: 'documento.pdf',
    mimetype: 'application/pdf',
    size: 1024,
    buffer: Buffer.from('fake-pdf-content'),
    ...overrides,
  };
}

describe('ArchivoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    esClient.index.mockResolvedValue({});
    esClient.update.mockResolvedValue({});
    esClient.delete.mockResolvedValue({});
  });

  describe('configuración de subida (Multer)', () => {
    it('expone middleware upload de multer', () => {
      expect(upload).toBeDefined();
      expect(typeof upload.single).toBe('function');
    });

    it('define extensiones permitidas: solo PDF e imágenes', () => {
      expect(ALLOWED_EXTENSIONS.has('.pdf')).toBe(true);
      expect(ALLOWED_EXTENSIONS.has('.jpg')).toBe(true);
      expect(ALLOWED_EXTENSIONS.has('.jpeg')).toBe(true);
      expect(ALLOWED_EXTENSIONS.has('.png')).toBe(true);
      expect(ALLOWED_EXTENSIONS.has('.gif')).toBe(true);
      expect(ALLOWED_EXTENSIONS.has('.exe')).toBe(false);
      expect(ALLOWED_EXTENSIONS.has('.doc')).toBe(false);
      expect(ALLOWED_EXTENSIONS.has('.zip')).toBe(false);
    });

    it('fileFilter acepta PDF', (done) => {
      fileFilter({}, { originalname: 'informe.PDF' }, (err, accept) => {
        expect(err).toBeNull();
        expect(accept).toBe(true);
        done();
      });
    });

    it('fileFilter acepta imágenes (jpg, png, gif)', (done) => {
      fileFilter({}, { originalname: 'foto.jpg' }, (err, accept) => {
        expect(err).toBeNull();
        expect(accept).toBe(true);
        done();
      });
    });

    it('fileFilter rechaza extensiones no permitidas con ValidationError', (done) => {
      fileFilter({}, { originalname: 'virus.exe' }, (err) => {
        expect(err).toBeDefined();
        expect(err.statusCode).toBe(400);
        expect(err.message).toMatch(/Invalid file type/);
        done();
      });
    });

    it('fileFilter rechaza .zip y .docx', (done) => {
      fileFilter({}, { originalname: 'data.zip' }, (err) => {
        expect(err).toBeDefined();
        expect(err.statusCode).toBe(400);
        done();
      });
    });
  });

  describe('uploadFile', () => {
    it('sube un archivo, renombra con UUID e indexa metadata en ES', async () => {
      const repo = mockRepository();
      const service = new ArchivoService(repo);
      const file = mockFile();

      const result = await service.uploadFile(file, {
        entidadAsociada: 'evento',
        uuidAsociado: '660e8400-e29b-41d4-a716-446655440001',
        usuarioId: 10,
        carpeta: 'documentos',
      });

      expect(result).toEqual(archivoFixture);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          nombreOriginal: 'documento.pdf',
          tipo: 'application/pdf',
          tamano: 1024,
          extension: '.pdf',
        }),
      );
      // Nombre almacenado con UUID + extensión
      const storedName = repo.create.mock.calls[0][0].nombreAlmacenado;
      expect(storedName).toMatch(/^[0-9a-f-]{36}\.pdf$/);
      // Ruta bajo UPLOAD_DIR (compatible Windows/POSIX)
      expect(repo.create.mock.calls[0][0].ruta).toMatch(/tmp.+uploads-test/);
      // Indexación ES
      expect(esClient.index).toHaveBeenCalledWith(
        expect.objectContaining({
          index: 'test_uajs_storage',
          id: archivoFixture.uuid,
        }),
      );
    });

    it('usa valores por defecto cuando no hay metadata', async () => {
      const repo = mockRepository();
      const service = new ArchivoService(repo);

      await service.uploadFile(mockFile(), undefined);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ carpeta: 'general', publico: false }),
      );
    });

    it('retorna el archivo aunque falle la indexación en ES', async () => {
      esClient.index.mockRejectedValue(new Error('ES down'));
      const repo = mockRepository();
      const service = new ArchivoService(repo);

      const result = await service.uploadFile(mockFile(), {});

      expect(result).toEqual(archivoFixture);
    });
  });

  describe('getFileById / getFileByUuid', () => {
    it('retorna archivo por ID', async () => {
      const service = new ArchivoService(mockRepository());
      const result = await service.getFileById(1);
      expect(result.id).toBe(1);
    });

    it('lanza NotFoundError si el ID no existe', async () => {
      const service = new ArchivoService(mockRepository({ findById: jest.fn().mockResolvedValue(null) }));
      await expect(service.getFileById(999)).rejects.toThrow(NotFoundError);
    });

    it('retorna archivo por UUID', async () => {
      const service = new ArchivoService(mockRepository());
      const result = await service.getFileByUuid(archivoFixture.uuid);
      expect(result.uuid).toBe(archivoFixture.uuid);
    });

    it('lanza NotFoundError si el UUID no existe', async () => {
      const service = new ArchivoService(
        mockRepository({ findByUuid: jest.fn().mockResolvedValue(null) }),
      );
      await expect(service.getFileByUuid('no-existe')).rejects.toThrow(NotFoundError);
    });
  });

  describe('listFiles', () => {
    it('delega paginación al repositorio', async () => {
      const repo = mockRepository();
      const service = new ArchivoService(repo);
      const result = await service.listFiles({ page: 2, limit: 10 });

      expect(repo.findAll).toHaveBeenCalledWith({ page: 2, limit: 10 });
      expect(result.total).toBe(1);
    });
  });

  describe('updateFile', () => {
    it('actualiza y sincroniza en ES', async () => {
      const repo = mockRepository();
      const service = new ArchivoService(repo);

      const result = await service.updateFile(1, { carpeta: 'nueva' });

      expect(repo.update).toHaveBeenCalledWith(1, { carpeta: 'nueva' });
      expect(esClient.update).toHaveBeenCalledWith(
        expect.objectContaining({ index: 'test_uajs_storage', id: archivoFixture.uuid }),
      );
      expect(result).toEqual(archivoFixture);
    });

    it('retorna aunque falle ES en update', async () => {
      esClient.update.mockRejectedValue(new Error('ES down'));
      const service = new ArchivoService(mockRepository());
      const result = await service.updateFile(1, { carpeta: 'x' });
      expect(result).toEqual(archivoFixture);
    });
  });

  describe('deleteFile', () => {
    it('elimina y borra documento de ES', async () => {
      const repo = mockRepository();
      const service = new ArchivoService(repo);

      const result = await service.deleteFile(1);

      expect(repo.delete).toHaveBeenCalledWith(1);
      expect(esClient.delete).toHaveBeenCalledWith(
        expect.objectContaining({ index: 'test_uajs_storage', id: archivoFixture.uuid }),
      );
      expect(result).toEqual({ success: true });
    });

    it('lanza NotFoundError si no existe', async () => {
      const service = new ArchivoService(mockRepository({ findById: jest.fn().mockResolvedValue(null) }));
      await expect(service.deleteFile(999)).rejects.toThrow(NotFoundError);
    });

    it('retorna success aunque falle ES en delete', async () => {
      esClient.delete.mockRejectedValue(new Error('ES down'));
      const service = new ArchivoService(mockRepository());
      const result = await service.deleteFile(1);
      expect(result).toEqual({ success: true });
    });
  });

  describe('searchFiles', () => {
    it('delega búsqueda al repositorio (ES)', async () => {
      const repo = mockRepository();
      const service = new ArchivoService(repo);
      const result = await service.searchFiles({ search: 'contrato', limit: 10 });

      expect(repo.searchInElasticsearch).toHaveBeenCalledWith({ search: 'contrato', limit: 10 });
      expect(result.total).toBe(1);
      expect(result.files).toHaveLength(1);
    });
  });
});
