describe('Configuración de Logger', () => {
  it('debe exportar una instancia de winston logger', () => {
    jest.isolateModules(() => {
      jest.unmock('../../../src/config/logger');
      const logger = require('../../../src/config/logger');
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
    });
  });
});
