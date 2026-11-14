const {
  updatePerfilSchema,
  updatePreferenciasSchema,
  listUsuariosQuerySchema,
  userIdParamSchema,
} = require('../../../src/modules/usuario/usuario.validation');

const perfilValido = {
  firstName: 'Ana',
  lastName: 'Pérez',
};

describe('usuario.validation', () => {
  describe('updatePerfilSchema', () => {
    it('acepta un perfil mínimo y aplica valores por defecto', () => {
      const result = updatePerfilSchema.safeParse(perfilValido);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        firstName: 'Ana',
        lastName: 'Pérez',
        documentNumber: null,
        phone: null,
        avatarFileUuid: null,
        birthDate: null,
        cityCode: null,
        timezone: 'America/Bogota',
        locale: 'es-CO',
      });
    });

    it('recorta espacios en los nombres', () => {
      const result = updatePerfilSchema.safeParse({ ...perfilValido, firstName: '  Ana  ' });

      expect(result.data.firstName).toBe('Ana');
    });

    it('rechaza nombres demasiado cortos', () => {
      const result = updatePerfilSchema.safeParse({ ...perfilValido, firstName: 'A' });

      expect(result.success).toBe(false);
      expect(result.error.errors[0].path).toEqual(['firstName']);
    });

    it('rechaza un UUID de avatar inválido', () => {
      const result = updatePerfilSchema.safeParse({ ...perfilValido, avatarFileUuid: 'no-uuid' });

      expect(result.success).toBe(false);
    });

    it('acepta un UUID de avatar válido', () => {
      const result = updatePerfilSchema.safeParse({
        ...perfilValido,
        avatarFileUuid: '123e4567-e89b-42d3-a456-426614174000',
      });

      expect(result.success).toBe(true);
    });

    it('rechaza fecha de nacimiento con formato inválido', () => {
      const result = updatePerfilSchema.safeParse({ ...perfilValido, birthDate: '10/05/1999' });

      expect(result.success).toBe(false);
    });

    it('rechaza fecha de nacimiento inexistente', () => {
      const result = updatePerfilSchema.safeParse({ ...perfilValido, birthDate: '2001-02-30' });

      expect(result.success).toBe(false);
    });

    it('rechaza fecha de nacimiento futura', () => {
      const result = updatePerfilSchema.safeParse({ ...perfilValido, birthDate: '2999-01-01' });

      expect(result.success).toBe(false);
    });

    it('acepta fecha de nacimiento pasada válida', () => {
      const result = updatePerfilSchema.safeParse({ ...perfilValido, birthDate: '1999-05-10' });

      expect(result.success).toBe(true);
    });

    it('rechaza un idioma que no cumple BCP 47', () => {
      const result = updatePerfilSchema.safeParse({ ...perfilValido, locale: 'español' });

      expect(result.success).toBe(false);
    });
  });

  describe('updatePreferenciasSchema', () => {
    it('aplica valores por defecto cuando el cuerpo está vacío', () => {
      const result = updatePreferenciasSchema.safeParse({});

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        notifyEmail: true,
        notifyPush: true,
        quietHoursStart: null,
        quietHoursEnd: null,
      });
    });

    it('acepta horario de silencio con HH:mm o HH:mm:ss', () => {
      const result = updatePreferenciasSchema.safeParse({
        quietHoursStart: '22:00:00',
        quietHoursEnd: '06:30',
      });

      expect(result.success).toBe(true);
    });

    it('rechaza una hora fuera de rango', () => {
      const result = updatePreferenciasSchema.safeParse({
        quietHoursStart: '25:00',
        quietHoursEnd: '06:30',
      });

      expect(result.success).toBe(false);
    });

    it('rechaza horario de silencio incompleto', () => {
      const result = updatePreferenciasSchema.safeParse({
        quietHoursStart: '22:00',
        quietHoursEnd: null,
      });

      expect(result.success).toBe(false);
      expect(result.error.errors[0].path).toEqual(['quietHoursEnd']);
    });

    it('rechaza flags que no son booleanos', () => {
      const result = updatePreferenciasSchema.safeParse({ notifyEmail: 'si' });

      expect(result.success).toBe(false);
    });
  });

  describe('listUsuariosQuerySchema', () => {
    it('convierte page y limit a número con valores por defecto', () => {
      const result = listUsuariosQuerySchema.safeParse({});

      expect(result.data).toEqual({ page: 1, limit: 20 });
    });

    it('convierte cadenas numéricas', () => {
      const result = listUsuariosQuerySchema.safeParse({ page: '3', limit: '50', search: 'Ana' });

      expect(result.data).toEqual({ page: 3, limit: 50, search: 'Ana' });
    });

    it('rechaza limit mayor a 100', () => {
      const result = listUsuariosQuerySchema.safeParse({ limit: '101' });

      expect(result.success).toBe(false);
    });

    it('rechaza page no positiva', () => {
      const result = listUsuariosQuerySchema.safeParse({ page: '0' });

      expect(result.success).toBe(false);
    });
  });

  describe('userIdParamSchema', () => {
    it('convierte el id a número', () => {
      const result = userIdParamSchema.safeParse({ userId: '42' });

      expect(result.data.userId).toBe(42);
    });

    it('rechaza ids no numéricos o no positivos', () => {
      expect(userIdParamSchema.safeParse({ userId: 'abc' }).success).toBe(false);
      expect(userIdParamSchema.safeParse({ userId: '0' }).success).toBe(false);
    });
  });
});
