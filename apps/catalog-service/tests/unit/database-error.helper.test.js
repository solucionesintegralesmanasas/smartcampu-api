const { mapDatabaseError } = require('../../src/core/helpers/database-error.helper');
const { ConflictError, ValidationError } = require('../../src/core/exceptions');

describe('mapDatabaseError (Unit Tests)', () => {
  it('debe traducir ER_DUP_ENTRY a ConflictError (409)', () => {
    const error = mapDatabaseError({ code: 'ER_DUP_ENTRY' });

    expect(error).toBeInstanceOf(ConflictError);
    expect(error.statusCode).toBe(409);
  });

  it('debe traducir referencias inexistentes a ValidationError (400)', () => {
    const error = mapDatabaseError({ code: 'ER_NO_REFERENCED_ROW_2' });

    expect(error).toBeInstanceOf(ValidationError);
    expect(error.statusCode).toBe(400);
  });

  it('debe traducir filas referenciadas a ConflictError (409)', () => {
    const error = mapDatabaseError({ code: 'ER_ROW_IS_REFERENCED_2' });

    expect(error).toBeInstanceOf(ConflictError);
  });

  it('debe devolver null para errores que no son de restricción', () => {
    expect(mapDatabaseError({ code: 'ECONNREFUSED' })).toBeNull();
    expect(mapDatabaseError(new Error('sin código'))).toBeNull();
    expect(mapDatabaseError(null)).toBeNull();
  });
});
