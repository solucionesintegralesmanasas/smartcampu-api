const UserProvisioningService = require('../../../src/core/services/user-provisioning.service');

describe('UserProvisioningService', () => {
  let mockPool;
  let service;

  beforeEach(() => {
    mockPool = {
      query: jest.fn(),
    };
    service = new UserProvisioningService(mockPool);
  });

  it('debe crear un usuario nuevo y asignarle el rol STUDENT', async () => {
    const person = {
      id: 10,
      primerNombre: 'Carlos',
      primerApellido: 'Gomez',
      email: 'carlos.gomez@uajs.edu.co',
      numeroDocumento: '1098765432',
      tipoDocumento: 'CC',
    };

    // 1. SELECT users -> no existe
    mockPool.query
      .mockResolvedValueOnce([]) // existingUsers
      .mockResolvedValueOnce({ insertId: 50 }) // insert persons uajs_auth
      .mockResolvedValueOnce({ insertId: 99 }) // insert users uajs_auth
      .mockResolvedValueOnce([{ id: 3 }]) // select roles
      .mockResolvedValueOnce({ affectedRows: 1 }); // insert user_roles

    const result = await service.provisionUser({ person, roleName: 'STUDENT' });

    expect(result).toBeDefined();
    expect(result.userId).toBe(99);
    expect(result.role).toBe('STUDENT');
    expect(result.email).toBe('carlos.gomez@uajs.edu.co');
    expect(typeof result.userUuid).toBe('string');
    expect(result.userUuid).toHaveLength(36);
  });

  it('debe reutilizar un usuario existente y asignarle el rol TEACHER', async () => {
    const person = {
      id: 20,
      primerNombre: 'Ana',
      primerApellido: 'Perez',
      email: 'ana.perez@uajs.edu.co',
    };

    // 1. SELECT users -> ya existe
    mockPool.query
      .mockResolvedValueOnce([
        { id: 45, uuid: 'existing-uuid-1234', email: 'ana.perez@uajs.edu.co' },
      ])
      .mockResolvedValueOnce([{ id: 4 }]) // select roles
      .mockResolvedValueOnce({ affectedRows: 1 }); // insert user_roles

    const result = await service.provisionUser({ person, roleName: 'TEACHER' });

    expect(result).toBeDefined();
    expect(result.userId).toBe(45);
    expect(result.userUuid).toBe('existing-uuid-1234');
    expect(result.role).toBe('TEACHER');
  });

  it('debe generar un correo institucional si la persona no tiene email', async () => {
    const person = {
      id: 30,
      primerNombre: 'Luis',
      primerApellido: 'Martínez',
      numeroDocumento: '12345678',
    };

    mockPool.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ insertId: 60 })
      .mockResolvedValueOnce({ insertId: 101 })
      .mockResolvedValueOnce([{ id: 3 }])
      .mockResolvedValueOnce({ affectedRows: 1 });

    const result = await service.provisionUser({ person, roleName: 'STUDENT' });

    expect(result.email).toContain('luis.martnez.12345678@estudiantes.uajs.edu.co');
  });

  it('debe responder con fallback seguro si uajs_auth falla o no existe', async () => {
    const person = { id: 40, email: 'error@uajs.edu.co' };
    mockPool.query.mockRejectedValueOnce(new Error('Table uajs_auth.users does not exist'));

    const result = await service.provisionUser({ person, roleName: 'STUDENT' });

    expect(result).toBeDefined();
    expect(result.role).toBe('STUDENT');
    expect(typeof result.userUuid).toBe('string');
    expect(result.userUuid).toHaveLength(36);
  });
});
