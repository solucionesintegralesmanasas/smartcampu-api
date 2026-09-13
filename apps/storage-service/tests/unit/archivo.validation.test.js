const {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
} = require('../../src/core/exceptions');
const { getPaginationMeta } = require('../../src/core/helpers/pagination.helper');
const {
  createFileMetadataSchema,
  updateFileSchema,
  listFilesQuerySchema,
  searchFilesQuerySchema,
} = require('../../src/modules/archivo/archivo.validation');

describe('archivo.validation', () => {
  describe('createFileMetadataSchema', () => {
    it('aplica valores por defecto', () => {
      const result = createFileMetadataSchema.safeParse({});
      expect(result.success).toBe(true);
      expect(result.data.carpeta).toBe('general');
      expect(result.data.publico).toBe(false);
    });

    it('acepta metadata completa válida', () => {
      const result = createFileMetadataSchema.safeParse({
        entidadAsociada: 'evento',
        uuidAsociado: '550e8400-e29b-41d4-a716-446655440000',
        carpeta: 'docs',
        publico: true,
      });
      expect(result.success).toBe(true);
    });

    it('rechaza UUID asociado inválido', () => {
      const result = createFileMetadataSchema.safeParse({ uuidAsociado: 'no-uuid' });
      expect(result.success).toBe(false);
    });
  });

  describe('updateFileSchema', () => {
    it('acepta actualización parcial', () => {
      expect(updateFileSchema.safeParse({ carpeta: 'nueva' }).success).toBe(true);
    });

    it('rechaza nombre vacío', () => {
      expect(updateFileSchema.safeParse({ nombreOriginal: '' }).success).toBe(false);
    });
  });

  describe('listFilesQuerySchema', () => {
    it('aplica paginación por defecto', () => {
      const result = listFilesQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
    });

    it('rechaza límite mayor a 100', () => {
      expect(listFilesQuerySchema.safeParse({ limit: 500 }).success).toBe(false);
    });
  });

  describe('searchFilesQuerySchema', () => {
    it('acepta búsqueda con q', () => {
      const result = searchFilesQuerySchema.safeParse({ q: 'contrato' });
      expect(result.success).toBe(true);
      expect(result.data.offset).toBe(0);
    });

    it('acepta búsqueda con search', () => {
      expect(searchFilesQuerySchema.safeParse({ search: 'informe' }).success).toBe(true);
    });
  });
});

describe('pagination.helper', () => {
  it('calcula metadatos de paginación', () => {
    const meta = getPaginationMeta(2, 10, 25);
    expect(meta).toEqual({
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
});
