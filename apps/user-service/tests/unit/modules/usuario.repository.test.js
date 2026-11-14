const UsuarioRepository = require('../../../src/modules/usuario/usuario.repository');

describe('UsuarioRepository', () => {
  let pool;
  let repo;

  beforeEach(() => {
    pool = { query: jest.fn() };
    repo = new UsuarioRepository(pool);
  });

  describe('findPerfilByUserId', () => {
    it('consulta solo perfiles no eliminados y devuelve la primera fila', async () => {
      pool.query.mockResolvedValue([{ id: 1, userId: 42 }]);

      const result = await repo.findPerfilByUserId(42);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('deleted_at IS NULL'),
        [42],
      );
      expect(result).toEqual({ id: 1, userId: 42 });
    });

    it('devuelve null cuando no hay filas', async () => {
      pool.query.mockResolvedValue([]);

      await expect(repo.findPerfilByUserId(42)).resolves.toBeNull();
    });
  });

  describe('upsertPerfil', () => {
    it('inserta o actualiza por user_id y luego relee el perfil', async () => {
      pool.query
        .mockResolvedValueOnce({ affectedRows: 1, insertId: 1 })
        .mockResolvedValueOnce([{ id: 1, userId: 42, firstName: 'Ana' }]);
      const data = {
        firstName: 'Ana',
        lastName: 'Pérez',
        documentNumber: null,
        phone: null,
        avatarFileUuid: null,
        birthDate: null,
        cityCode: null,
        timezone: 'America/Bogota',
        locale: 'es-CO',
      };

      const result = await repo.upsertPerfil(42, data);

      const [insertSql, insertParams] = pool.query.mock.calls[0];
      expect(insertSql).toContain('ON DUPLICATE KEY UPDATE');
      expect(insertSql).toContain('deleted_at = NULL');
      expect(insertParams).toEqual([
        42, 'Ana', 'Pérez', null, null, null, null, null, 'America/Bogota', 'es-CO',
      ]);
      expect(result).toEqual({ id: 1, userId: 42, firstName: 'Ana' });
    });
  });

  describe('findPreferenciasByUserId', () => {
    it('devuelve la fila o null', async () => {
      pool.query.mockResolvedValueOnce([{ id: 2, userId: 42 }]).mockResolvedValueOnce([]);

      await expect(repo.findPreferenciasByUserId(42)).resolves.toEqual({ id: 2, userId: 42 });
      await expect(repo.findPreferenciasByUserId(43)).resolves.toBeNull();
    });
  });

  describe('upsertPreferencias', () => {
    it('convierte los booleanos a 0/1 antes de guardar', async () => {
      pool.query
        .mockResolvedValueOnce({ affectedRows: 1 })
        .mockResolvedValueOnce([{
          id: 2, userId: 42, notifyEmail: 0, notifyPush: 1,
        }]);

      await repo.upsertPreferencias(42, {
        notifyEmail: false,
        notifyPush: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
      });

      const [, params] = pool.query.mock.calls[0];
      expect(params).toEqual([42, 0, 1, '22:00', '07:00']);
    });
  });

  describe('findAllPerfiles', () => {
    it('cuenta y pagina sin filtro cuando no hay búsqueda', async () => {
      pool.query
        .mockResolvedValueOnce([{ total: '2' }])
        .mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);

      const result = await repo.findAllPerfiles({ limit: 10, offset: 0, search: '' });

      expect(pool.query.mock.calls[0][1]).toEqual([]);
      expect(pool.query.mock.calls[1][1]).toEqual([10, 0]);
      expect(result).toEqual({ rows: [{ id: 1 }, { id: 2 }], total: 2 });
    });

    it('busca por nombre o documento y escapa los comodines de LIKE', async () => {
      pool.query.mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]);

      await repo.findAllPerfiles({ limit: 20, offset: 40, search: '50%_' });

      const [countSql, countParams] = pool.query.mock.calls[0];
      expect(countSql).toContain('document_number LIKE ?');
      expect(countParams).toEqual([
        '%50\\%\\_%', '%50\\%\\_%', '%50\\%\\_%', '%50\\%\\_%',
      ]);
      expect(pool.query.mock.calls[1][1]).toEqual([
        '%50\\%\\_%', '%50\\%\\_%', '%50\\%\\_%', '%50\\%\\_%', 20, 40,
      ]);
    });

    it('devuelve total 0 cuando el conteo no trae filas', async () => {
      pool.query.mockResolvedValueOnce([{ total: null }]).mockResolvedValueOnce([]);

      const result = await repo.findAllPerfiles({ limit: 20, offset: 0, search: '' });

      expect(result.total).toBe(0);
    });
  });

  describe('softDeletePerfil', () => {
    it('devuelve true cuando se marcó un perfil como eliminado', async () => {
      pool.query.mockResolvedValue({ affectedRows: 1 });

      await expect(repo.softDeletePerfil(42)).resolves.toBe(true);
      expect(pool.query.mock.calls[0][0]).toContain('SET deleted_at = NOW()');
    });

    it('devuelve false cuando no había perfil activo', async () => {
      pool.query.mockResolvedValue({ affectedRows: 0 });

      await expect(repo.softDeletePerfil(42)).resolves.toBe(false);
    });
  });

  describe('getPool', () => {
    it('reutiliza el pool inyectado', () => {
      expect(repo.getPool()).toBe(pool);
    });
  });
});
