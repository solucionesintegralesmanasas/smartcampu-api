const { ROLES_GESTION, tieneRol } = require('../../src/core/helpers/roles.helper');

describe('roles.helper', () => {
  it('ROLES_GESTION contiene ADMIN y STAFF', () => {
    expect(ROLES_GESTION).toEqual(expect.arrayContaining(['ADMIN', 'STAFF']));
  });

  it('tieneRol detecta roles válidos y tolera usuarios nulos', () => {
    expect(tieneRol({ roles: ['STAFF'] }, ROLES_GESTION)).toBe(true);
    expect(tieneRol({ roles: ['STUDENT'] }, ROLES_GESTION)).toBe(false);
    expect(tieneRol(null, ROLES_GESTION)).toBe(false);
    expect(tieneRol({ roles: null }, ROLES_GESTION)).toBe(false);
  });
});
