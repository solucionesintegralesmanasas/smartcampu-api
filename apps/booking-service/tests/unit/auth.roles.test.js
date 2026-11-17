const { tieneRol, esAdmin, esGestor } = require('../../src/modules/auth/auth.roles');

describe('auth.roles', () => {
  it('tieneRol detecta roles presentes', () => {
    expect(tieneRol({ roles: ['ADMIN'] }, ['ADMIN', 'STAFF'])).toBe(true);
    expect(tieneRol({ roles: ['STUDENT'] }, ['ADMIN'])).toBe(false);
    expect(tieneRol(null, ['ADMIN'])).toBe(false);
    expect(tieneRol({ roles: 'ADMIN' }, ['ADMIN'])).toBe(false);
  });

  it('esAdmin y esGestor clasifican correctamente', () => {
    expect(esAdmin({ roles: ['ADMIN'] })).toBe(true);
    expect(esAdmin({ roles: ['STAFF'] })).toBe(false);
    expect(esGestor({ roles: ['STAFF'] })).toBe(true);
    expect(esGestor({ roles: ['STUDENT'] })).toBe(false);
  });
});
