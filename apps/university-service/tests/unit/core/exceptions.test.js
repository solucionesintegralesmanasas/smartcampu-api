const {
  AppError,
  NotFoundError,
  ValidationError,
  ConflictError,
} = require('../../../src/core/exceptions');

describe('Excepciones del Core', () => {
  it('AppError debe instanciarse con mensaje y statusCode', () => {
    const error = new AppError('Error personalizado', 500);
    expect(error.message).toBe('Error personalizado');
    expect(error.statusCode).toBe(500);
    expect(error.name).toBe('AppError');
  });

  it('NotFoundError debe tener statusCode 404', () => {
    const error = new NotFoundError('No existe el recurso');
    expect(error.message).toBe('No existe el recurso');
    expect(error.statusCode).toBe(404);
  });

  it('ValidationError debe tener statusCode 400 y array de errores', () => {
    const error = new ValidationError('Datos inválidos', [
      { field: 'email', message: 'Requerido' },
    ]);
    expect(error.message).toBe('Datos inválidos');
    expect(error.statusCode).toBe(400);
    expect(error.errors).toHaveLength(1);
    expect(error.errors[0].field).toBe('email');
  });

  it('ConflictError debe tener statusCode 409', () => {
    const error = new ConflictError('Registro duplicado');
    expect(error.message).toBe('Registro duplicado');
    expect(error.statusCode).toBe(409);
  });
});
