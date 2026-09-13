const {
  paginationHelper,
  paginateResult,
  getPaginationMeta,
} = require('../../../src/core/helpers/pagination.helper');

describe('Pagination Helper', () => {
  describe('paginationHelper', () => {
    it('debe devolver valores por defecto cuando no se pasan argumentos', () => {
      const result = paginationHelper();
      expect(result).toEqual({ page: 1, limit: 20, offset: 0 });
    });

    it('debe calcular correctamente el offset para una página y límite dados', () => {
      const result = paginationHelper(3, 10);
      expect(result).toEqual({ page: 3, limit: 10, offset: 20 });
    });

    it('debe limitar el tamaño máximo de limit a 100', () => {
      const result = paginationHelper(1, 500);
      expect(result.limit).toBe(100);
    });

    it('debe normalizar valores no numéricos o negativos a 1', () => {
      const result = paginationHelper(-5, -10);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(1);
    });
  });

  describe('paginateResult', () => {
    it('debe estructurar el resultado paginado con metadata correcta', () => {
      const items = [{ id: 1 }, { id: 2 }];
      const result = paginateResult(items, 50, 2, 10);

      expect(result).toEqual({
        data: items,
        pagination: {
          page: 2,
          limit: 10,
          total: 50,
          totalPages: 5,
        },
      });
    });
  });

  describe('getPaginationMeta', () => {
    it('debe calcular las páginas totales correctamente', () => {
      const meta = getPaginationMeta(1, 20, 45);
      expect(meta).toEqual({
        page: 1,
        limit: 20,
        total: 45,
        totalPages: 3,
      });
    });
  });
});
