const exceptions = require('../../../src/core/exceptions');
const {
  MAX_LIMIT,
  paginationHelper,
  getPaginationMeta,
} = require('../../../src/core/helpers/pagination.helper');

describe('pagination.helper', () => {
  it('calcula offset a partir de página y límite', () => {
    expect(paginationHelper('3', '10')).toEqual({ page: 3, limit: 10, offset: 20 });
  });

  it('usa valores por defecto ante entradas no válidas', () => {
    expect(paginationHelper('abc', 'xyz')).toEqual({ page: 1, limit: 20, offset: 0 });
    expect(paginationHelper(-5, 0)).toEqual({ page: 1, limit: 20, offset: 0 });
  });

  it('limita el límite a MAX_LIMIT', () => {
    expect(MAX_LIMIT).toBe(100);
    expect(paginationHelper(1, 1000).limit).toBe(100);
  });

  it('genera el meta estándar con totalPages redondeado hacia arriba', () => {
    expect(getPaginationMeta(1, 20, 41)).toEqual({
      page: 1, limit: 20, total: 41, totalPages: 3,
    });
  });
});

describe('core/exceptions', () => {
  it('asigna el código HTTP de cada error', () => {
    expect(new exceptions.NotFoundError().statusCode).toBe(404);
    expect(new exceptions.ForbiddenError().statusCode).toBe(403);
    expect(new exceptions.UnauthorizedError().statusCode).toBe(401);
    expect(new exceptions.ValidationError('x', [{ field: 'a' }]).errors).toEqual([{ field: 'a' }]);
    expect(new exceptions.ValidationError().statusCode).toBe(400);
  });

  it('usa mensajes por defecto en español', () => {
    expect(new exceptions.NotFoundError().message).toBe('Recurso no encontrado');
    expect(new exceptions.ForbiddenError().message).toBe('Acceso denegado');
    expect(new exceptions.UnauthorizedError().message).toBe('No autorizado');
  });
});
