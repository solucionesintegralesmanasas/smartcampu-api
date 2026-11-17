const { checkResourceAvailability, getResource } = require('../../src/clients/resource.client');

describe('resource.client', () => {
  afterEach(() => {
    delete global.fetch;
  });

  describe('getResource', () => {
    it('retorna el recurso si resource-service responde ok', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { id: 10, uuid: 'r1', name: 'Aula 101' } }),
      });
      const result = await getResource(10);
      expect(result).toEqual({ id: 10, uuid: 'r1', name: 'Aula 101' });
    });

    it('retorna null si resource-service responde con error', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false });
      const result = await getResource(999);
      expect(result).toBeNull();
    });

    it('retorna null si la llamada falla (servicio caído)', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
      const result = await getResource(10);
      expect(result).toBeNull();
    });
  });

  describe('checkResourceAvailability', () => {
    it('retorna el resultado de resource-service si responde ok', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { available: true } }),
      });
      const result = await checkResourceAvailability(10, {
        date: '2026-02-02', startTime: '09:00', endTime: '10:00',
      });
      expect(result).toEqual({ available: true });
    });

    it('degrada a no-disponible si resource-service no responde', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('timeout'));
      const result = await checkResourceAvailability(10, {
        date: '2026-02-02', startTime: '09:00', endTime: '10:00',
      });
      expect(result).toEqual({ available: false, reason: 'resource_service_unreachable' });
    });

    it('degrada a no-disponible si resource-service responde con error', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false });
      const result = await checkResourceAvailability(10, {
        date: '2026-02-02', startTime: '09:00', endTime: '10:00',
      });
      expect(result).toEqual({ available: false, reason: 'resource_service_error' });
    });
  });
});
