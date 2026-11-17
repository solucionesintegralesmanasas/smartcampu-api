const { NotFoundError } = require('../../../src/core/exceptions');
const UsuarioService = require('../../../src/modules/usuario/usuario.service');

describe('UsuarioService', () => {
  let repo;
  let service;

  const perfilRow = {
    id: 1,
    uuid: 'uuid-perfil',
    userId: 42,
    firstName: 'Ana',
    lastName: 'Pérez',
    documentNumber: '1020304050',
    phone: null,
    avatarFileUuid: null,
    birthDate: '1999-05-10',
    cityCode: '11001',
    timezone: 'America/Bogota',
    locale: 'es-CO',
  };

  beforeEach(() => {
    repo = {
      findPerfilByUserId: jest.fn(),
      upsertPerfil: jest.fn(),
      findPreferenciasByUserId: jest.fn(),
      upsertPreferencias: jest.fn(),
      findAllPerfiles: jest.fn(),
      softDeletePerfil: jest.fn(),
    };
    service = new UsuarioService(repo);
  });

  describe('getMiPerfil', () => {
    it('devuelve el perfil del usuario cuando existe', async () => {
      repo.findPerfilByUserId.mockResolvedValue(perfilRow);

      const result = await service.getMiPerfil(42);

      expect(repo.findPerfilByUserId).toHaveBeenCalledWith(42);
      expect(result).toEqual(perfilRow);
    });

    it('lanza NotFoundError indicando cómo crear el perfil cuando no existe', async () => {
      repo.findPerfilByUserId.mockResolvedValue(null);

      await expect(service.getMiPerfil(42)).rejects.toThrow(NotFoundError);
      await expect(service.getMiPerfil(42)).rejects.toThrow('PUT /api/v1/usuarios/me');
    });
  });

  describe('upsertMiPerfil', () => {
    it('delega el upsert en el repositorio con el user_id del token', async () => {
      const dto = { firstName: 'Ana', lastName: 'Pérez', timezone: 'America/Bogota' };
      repo.upsertPerfil.mockResolvedValue({ ...perfilRow, ...dto });

      const result = await service.upsertMiPerfil(42, dto);

      expect(repo.upsertPerfil).toHaveBeenCalledWith(42, dto);
      expect(result.firstName).toBe('Ana');
    });
  });

  describe('getMisPreferencias', () => {
    it('devuelve valores por defecto cuando el usuario nunca guardó preferencias', async () => {
      repo.findPreferenciasByUserId.mockResolvedValue(null);

      const result = await service.getMisPreferencias(42);

      expect(result).toEqual({
        id: null,
        uuid: null,
        userId: 42,
        notifyEmail: true,
        notifyPush: true,
        quietHoursStart: null,
        quietHoursEnd: null,
        updatedAt: null,
      });
    });

    it('convierte los flags TINYINT a booleanos', async () => {
      repo.findPreferenciasByUserId.mockResolvedValue({
        id: 3,
        userId: 42,
        notifyEmail: 0,
        notifyPush: 1,
        quietHoursStart: '22:00:00',
        quietHoursEnd: '07:00:00',
      });

      const result = await service.getMisPreferencias(42);

      expect(result.notifyEmail).toBe(false);
      expect(result.notifyPush).toBe(true);
      expect(result.quietHoursStart).toBe('22:00:00');
    });
  });

  describe('upsertMisPreferencias', () => {
    it('guarda las preferencias y las devuelve con flags booleanos', async () => {
      const dto = {
        notifyEmail: false,
        notifyPush: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '06:30',
      };
      repo.upsertPreferencias.mockResolvedValue({
        id: 1, userId: 42, notifyEmail: 0, notifyPush: 1, ...dto,
      });

      const result = await service.upsertMisPreferencias(42, dto);

      expect(repo.upsertPreferencias).toHaveBeenCalledWith(42, dto);
      expect(result.notifyEmail).toBe(false);
      expect(result.notifyPush).toBe(true);
    });
  });

  describe('getPerfilPorUsuario', () => {
    it('devuelve el perfil de otro usuario', async () => {
      repo.findPerfilByUserId.mockResolvedValue(perfilRow);

      await expect(service.getPerfilPorUsuario(42)).resolves.toEqual(perfilRow);
    });

    it('lanza NotFoundError si el usuario no tiene perfil', async () => {
      repo.findPerfilByUserId.mockResolvedValue(null);

      await expect(service.getPerfilPorUsuario(99)).rejects.toThrow(NotFoundError);
    });
  });

  describe('listarPerfiles', () => {
    it('pagina con los valores normalizados y construye meta', async () => {
      repo.findAllPerfiles.mockResolvedValue({ rows: [perfilRow], total: 45 });

      const result = await service.listarPerfiles({ page: 2, limit: 20, search: 'Ana' });

      expect(repo.findAllPerfiles).toHaveBeenCalledWith({ limit: 20, offset: 20, search: 'Ana' });
      expect(result).toEqual({
        data: [perfilRow],
        meta: {
          page: 2, limit: 20, total: 45, totalPages: 3,
        },
      });
    });

    it('usa valores por defecto y no filtra cuando no hay query', async () => {
      repo.findAllPerfiles.mockResolvedValue({ rows: [], total: 0 });

      const result = await service.listarPerfiles();

      expect(repo.findAllPerfiles).toHaveBeenCalledWith({ limit: 20, offset: 0, search: '' });
      expect(result.meta).toEqual({
        page: 1, limit: 20, total: 0, totalPages: 0,
      });
    });

    it('limita el tamaño de página a 100', async () => {
      repo.findAllPerfiles.mockResolvedValue({ rows: [], total: 0 });

      const result = await service.listarPerfiles({ page: 1, limit: 500 });

      expect(result.meta.limit).toBe(100);
    });
  });

  describe('eliminarPerfil', () => {
    it('realiza el borrado lógico y devuelve un mensaje', async () => {
      repo.softDeletePerfil.mockResolvedValue(true);

      const result = await service.eliminarPerfil(42);

      expect(repo.softDeletePerfil).toHaveBeenCalledWith(42);
      expect(result).toEqual({ message: 'Perfil eliminado correctamente' });
    });

    it('lanza NotFoundError si no hay perfil activo que eliminar', async () => {
      repo.softDeletePerfil.mockResolvedValue(false);

      await expect(service.eliminarPerfil(42)).rejects.toThrow(NotFoundError);
    });
  });
});
