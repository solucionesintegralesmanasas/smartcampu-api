const { createSchema: countryCreate, updateSchema: countryUpdate } = require('../../src/modules/country/country.validation');
const { createSchema: departmentCreate, updateSchema: departmentUpdate } = require('../../src/modules/department/department.validation');
const { createSchema: cityCreate, updateSchema: cityUpdate } = require('../../src/modules/city/city.validation');
const { createSchema: documentTypeCreate, updateSchema: documentTypeUpdate } = require('../../src/modules/document-type/document-type.validation');
const { createSchema: campusCreate, updateSchema: campusUpdate } = require('../../src/modules/campus/campus.validation');

describe('Esquemas de validación (Zod)', () => {
  describe('country', () => {
    it('debe aceptar un país válido y normalizar el código ISO a mayúsculas', () => {
      const result = countryCreate.safeParse({ isoCode: 'co', isoCode3: 'col', name: 'Colombia' });

      expect(result.success).toBe(true);
      expect(result.data.isoCode).toBe('CO');
      expect(result.data.isoCode3).toBe('COL');
    });

    it('debe rechazar un código ISO alpha-2 inválido', () => {
      expect(countryCreate.safeParse({ isoCode: 'COL', name: 'Colombia' }).success).toBe(false);
      expect(countryCreate.safeParse({ isoCode: 'C1', name: 'Colombia' }).success).toBe(false);
    });

    it('debe rechazar un código ISO alpha-3 inválido', () => {
      expect(countryCreate.safeParse({ isoCode: 'CO', isoCode3: 'CO', name: 'Colombia' }).success).toBe(false);
    });

    it('debe permitir isoCode3 y phoneCode nulos', () => {
      const result = countryCreate.safeParse({
        isoCode: 'CO', isoCode3: null, name: 'Colombia', phoneCode: null,
      });
      expect(result.success).toBe(true);
    });

    it('debe rechazar nombres demasiado cortos o largos', () => {
      expect(countryCreate.safeParse({ isoCode: 'CO', name: 'C' }).success).toBe(false);
      expect(countryCreate.safeParse({ isoCode: 'CO', name: 'x'.repeat(101) }).success).toBe(false);
    });

    it('updateSchema debe aceptar un objeto parcial', () => {
      expect(countryUpdate.safeParse({ phoneCode: '+57' }).success).toBe(true);
      expect(countryUpdate.safeParse({ isoCode: 'XX1' }).success).toBe(false);
    });
  });

  describe('department', () => {
    it('debe exigir countryId entero positivo', () => {
      expect(departmentCreate.safeParse({ name: 'Antioquia' }).success).toBe(false);
      expect(departmentCreate.safeParse({ countryId: 0, name: 'Antioquia' }).success).toBe(false);
      expect(departmentCreate.safeParse({ countryId: 1, name: 'Antioquia' }).success).toBe(true);
    });

    it('debe limitar la longitud del nombre y del código DANE', () => {
      expect(departmentCreate.safeParse({ countryId: 1, name: 'A' }).success).toBe(false);
      expect(departmentCreate.safeParse({ countryId: 1, name: 'x'.repeat(101) }).success).toBe(false);
      expect(departmentCreate.safeParse({ countryId: 1, name: 'Antioquia', daneCode: '1'.repeat(11) }).success).toBe(false);
    });

    it('updateSchema debe ser parcial', () => {
      expect(departmentUpdate.safeParse({}).success).toBe(true);
    });
  });

  describe('city', () => {
    it('debe exigir stateId entero positivo y nombre válido', () => {
      expect(cityCreate.safeParse({ name: 'Medellín' }).success).toBe(false);
      expect(cityCreate.safeParse({ stateId: 1, name: 'Medellín' }).success).toBe(true);
      expect(cityCreate.safeParse({ stateId: 1, name: 'M' }).success).toBe(false);
    });

    it('updateSchema debe ser parcial', () => {
      expect(cityUpdate.safeParse({ daneCode: '05001' }).success).toBe(true);
    });
  });

  describe('document-type', () => {
    it('debe exigir código y nombre, normalizando el código', () => {
      expect(documentTypeCreate.safeParse({ name: 'Cédula' }).success).toBe(false);
      expect(documentTypeCreate.safeParse({ name: 'Cédula', code: '' }).success).toBe(false);

      const result = documentTypeCreate.safeParse({ name: 'Cédula', code: 'cc' });
      expect(result.success).toBe(true);
      expect(result.data.code).toBe('CC');
    });

    it('debe limitar nombre a 50 y código a 10 caracteres', () => {
      expect(documentTypeCreate.safeParse({ name: 'x'.repeat(51), code: 'CC' }).success).toBe(false);
      expect(documentTypeCreate.safeParse({ name: 'Cédula', code: 'x'.repeat(11) }).success).toBe(false);
    });

    it('debe aceptar los indicadores de la migración', () => {
      const result = documentTypeCreate.safeParse({
        name: 'NIT',
        code: 'NIT',
        requiresCheckDigit: true,
        appliesToNaturalPerson: false,
        appliesToLegalEntity: true,
      });
      expect(result.success).toBe(true);
    });

    it('updateSchema debe ser parcial', () => {
      expect(documentTypeUpdate.safeParse({ requiresCheckDigit: false }).success).toBe(true);
    });
  });

  describe('campus', () => {
    it('debe exigir cityId y nombre', () => {
      expect(campusCreate.safeParse({ name: 'Campus Robledo' }).success).toBe(false);
      expect(campusCreate.safeParse({ cityId: 1, name: 'Campus Robledo' }).success).toBe(true);
    });

    it('debe limitar dirección a 200 y teléfono a 20 caracteres', () => {
      expect(campusCreate.safeParse({ cityId: 1, name: 'Campus', address: 'x'.repeat(201) }).success).toBe(false);
      expect(campusCreate.safeParse({ cityId: 1, name: 'Campus', phone: '1'.repeat(21) }).success).toBe(false);
    });

    it('updateSchema debe ser parcial', () => {
      expect(campusUpdate.safeParse({ phone: '6045550000' }).success).toBe(true);
    });
  });
});
