const { env } = require('../../src/config/env');
const { NotFoundError } = require('../../src/core/exceptions');
const PerfilService = require('../../src/modules/perfil/perfil.service');

function mockRepository(overrides = {}) {
  return {
    findById: jest.fn().mockResolvedValue({
      id: 1, uuid: 'u1', email: 'a@test.com', nombre: 'Ana Pérez', roles: ['STUDENT'],
    }),
    update: jest.fn().mockResolvedValue({
      id: 1, uuid: 'u1', email: 'a@test.com', nombre: 'Ana Gómez', roles: ['STUDENT'],
    }),
    ...overrides,
  };
}

describe('PerfilService', () => {
  let repo;
  let service;
  const originalUniversityUrl = env.SERVICE_UNIVERSITY_URL;

  beforeEach(() => {
    repo = mockRepository();
    service = new PerfilService(repo);
    env.SERVICE_UNIVERSITY_URL = originalUniversityUrl;
    delete global.fetch;
  });

  afterAll(() => {
    env.SERVICE_UNIVERSITY_URL = originalUniversityUrl;
  });

  it('lanza NotFoundError si el usuario no existe', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.getPerfil(999)).rejects.toThrow(NotFoundError);
  });

  it('degrada a perfil básico si el usuario no tiene rol académico', async () => {
    repo.findById.mockResolvedValue({ id: 1, roles: ['ADMIN'] });

    const result = await service.getPerfil(1);

    expect(result.perfil).toEqual({ tipo: 'basico' });
  });

  it('degrada a perfil básico si SERVICE_UNIVERSITY_URL no está configurada', async () => {
    env.SERVICE_UNIVERSITY_URL = undefined;

    const result = await service.getPerfil(1);

    expect(result.perfil).toEqual({ tipo: 'basico' });
  });

  it('enriquece con datos de estudiante si university-service responde', async () => {
    env.SERVICE_UNIVERSITY_URL = 'http://university-service:3004';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { codigo: 'EST-001', programa: 'Sistemas' } }),
    });

    const result = await service.getPerfil(1);

    expect(result.perfil.tipo).toBe('estudiante');
    expect(result.perfil.estudiante).toEqual({ codigo: 'EST-001', programa: 'Sistemas' });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/estudiantes/by-user/u1'),
      expect.any(Object),
    );
  });

  it('degrada a perfil básico si la llamada a university-service falla', async () => {
    env.SERVICE_UNIVERSITY_URL = 'http://university-service:3004';
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await service.getPerfil(1);

    expect(result.perfil).toEqual({ tipo: 'basico' });
  });

  it('degrada a perfil básico si university-service responde con error', async () => {
    env.SERVICE_UNIVERSITY_URL = 'http://university-service:3004';
    global.fetch = jest.fn().mockResolvedValue({ ok: false });

    const result = await service.getPerfil(1);

    expect(result.perfil).toEqual({ tipo: 'basico' });
  });

  describe('updatePerfil', () => {
    it('actualiza el perfil y retorna los datos combinados', async () => {
      const result = await service.updatePerfil(1, { firstName: 'Ana' });

      expect(repo.update).toHaveBeenCalledWith(1, { firstName: 'Ana' });
      expect(result.nombre).toBe('Ana Gómez');
      expect(result.perfil).toEqual({ tipo: 'basico' });
    });

    it('lanza NotFoundError si el usuario no existe', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.updatePerfil(999, {})).rejects.toThrow(NotFoundError);
      expect(repo.update).not.toHaveBeenCalled();
    });
  });
});
