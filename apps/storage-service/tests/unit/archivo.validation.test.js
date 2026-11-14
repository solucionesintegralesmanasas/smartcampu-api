const {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} = require('../../src/core/exceptions');
const { getPaginationMeta } = require('../../src/core/helpers/pagination.helper');
const {
  ALLOWED_EXTENSIONS,
  createArchivoSchema,
  updateArchivoSchema,
  listArchivosQuerySchema,
  buscarArchivosQuerySchema,
  uuidParamSchema,
} = require('../../src/modules/archivo/archivo.validation');

const UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('archivo.validation', () => {
  describe('ALLOWED_EXTENSIONS', () => {
    it('solo permite PDF e imágenes', () => {
      expect(ALLOWED_EXTENSIONS).toEqual(['.pdf', '.jpg', '.jpeg', '.png', '.gif']);
    });
  });

  describe('createArchivoSchema', () => {
    it('aplica valores por defecto (carpeta general, privado)', () => {
      const result = createArchivoSchema.safeParse({});
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ carpeta: 'general', publico: false });
    });

    it('interpreta "false" de multipart como falso (no como truthy)', () => {
      const result = createArchivoSchema.safeParse({ publico: 'false' });
      expect(result.data.publico).toBe(false);
    });

    it('interpreta "true" y booleanos reales', () => {
      expect(createArchivoSchema.safeParse({ publico: 'true' }).data.publico).toBe(true);
      expect(createArchivoSchema.safeParse({ publico: true }).data.publico).toBe(true);
    });

    it('rechaza valores de publico que no son booleanos', () => {
      expect(createArchivoSchema.safeParse({ publico: 'si' }).success).toBe(false);
    });

    it('acepta metadata completa válida', () => {
      const result = createArchivoSchema.safeParse({
        entidadAsociada: 'request',
        uuidAsociado: UUID,
        carpeta: 'documentos',
        publico: 'true',
      });
      expect(result.success).toBe(true);
    });

    it('rechaza uuidAsociado sin entidadAsociada', () => {
      const result = createArchivoSchema.safeParse({ uuidAsociado: UUID });
      expect(result.success).toBe(false);
      expect(result.error.errors[0].path).toEqual(['entidadAsociada']);
    });

    it('rechaza UUID asociado inválido', () => {
      const result = createArchivoSchema.safeParse({
        entidadAsociada: 'request',
        uuidAsociado: 'no-uuid',
      });
      expect(result.success).toBe(false);
    });

    it('rechaza carpeta demasiado larga (máx. 100)', () => {
      expect(createArchivoSchema.safeParse({ carpeta: 'a'.repeat(101) }).success).toBe(false);
    });
  });

  describe('updateArchivoSchema', () => {
    it('acepta actualización parcial', () => {
      expect(updateArchivoSchema.safeParse({ carpeta: 'nueva' }).success).toBe(true);
    });

    it('rechaza un cuerpo sin campos', () => {
      expect(updateArchivoSchema.safeParse({}).success).toBe(false);
    });

    it('rechaza nombre vacío', () => {
      expect(updateArchivoSchema.safeParse({ nombreOriginal: '' }).success).toBe(false);
    });

    it('permite desvincular entidad con null', () => {
      const result = updateArchivoSchema.safeParse({ entidadAsociada: null, uuidAsociado: null });
      expect(result.success).toBe(true);
    });

    it('parsea flags de texto en activo y publico', () => {
      const result = updateArchivoSchema.safeParse({ activo: 'false', publico: 'true' });
      expect(result.data).toEqual({ activo: false, publico: true });
    });
  });

  describe('listArchivosQuerySchema', () => {
    it('aplica paginación por defecto', () => {
      const result = listArchivosQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
    });

    it('convierte page y limit numéricos desde query string', () => {
      const result = listArchivosQuerySchema.safeParse({ page: '3', limit: '10' });
      expect(result.data).toEqual(expect.objectContaining({ page: 3, limit: 10 }));
    });

    it('rechaza límite mayor a 100', () => {
      expect(listArchivosQuerySchema.safeParse({ limit: 500 }).success).toBe(false);
    });

    it('rechaza página no positiva', () => {
      expect(listArchivosQuerySchema.safeParse({ page: 0 }).success).toBe(false);
    });
  });

  describe('buscarArchivosQuerySchema', () => {
    it('exige el término de búsqueda', () => {
      const result = buscarArchivosQuerySchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('rechaza término vacío', () => {
      expect(buscarArchivosQuerySchema.safeParse({ search: '   ' }).success).toBe(false);
    });

    it('acepta término con filtros opcionales', () => {
      const result = buscarArchivosQuerySchema.safeParse({ search: 'contrato', tipo: 'application/pdf' });
      expect(result.success).toBe(true);
      expect(result.data.page).toBe(1);
    });
  });

  describe('uuidParamSchema', () => {
    it('acepta un UUID válido', () => {
      expect(uuidParamSchema.safeParse({ uuid: UUID }).success).toBe(true);
    });

    it('rechaza un identificador que no es UUID', () => {
      expect(uuidParamSchema.safeParse({ uuid: '12' }).success).toBe(false);
    });
  });
});

describe('pagination.helper', () => {
  it('calcula metadatos de paginación', () => {
    expect(getPaginationMeta(2, 10, 25)).toEqual({
      page: 2,
      limit: 10,
      total: 25,
      totalPages: 3,
      hasNextPage: true,
      hasPrevPage: true,
    });
  });

  it('detecta primera y última página', () => {
    expect(getPaginationMeta(1, 10, 5).hasPrevPage).toBe(false);
    expect(getPaginationMeta(1, 10, 5).hasNextPage).toBe(false);
  });
});

describe('excepciones', () => {
  it('AppError guarda mensaje y statusCode', () => {
    const err = new AppError('falla', 500);
    expect(err.message).toBe('falla');
    expect(err.statusCode).toBe(500);
  });

  it('ValidationError usa 400 por defecto', () => {
    const err = new ValidationError('inválido');
    expect(err.statusCode).toBe(400);
    expect(err.errors).toEqual([]);
  });

  it('NotFoundError usa 404', () => {
    expect(new NotFoundError().statusCode).toBe(404);
  });

  it('ConflictError usa 409', () => {
    expect(new ConflictError().statusCode).toBe(409);
  });

  it('UnauthorizedError usa 401 y ForbiddenError usa 403', () => {
    expect(new UnauthorizedError().statusCode).toBe(401);
    expect(new ForbiddenError().statusCode).toBe(403);
  });
});
