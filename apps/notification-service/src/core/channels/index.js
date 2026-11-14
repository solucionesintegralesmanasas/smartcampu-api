const LogChannelAdapter = require('./log-channel.adapter');

/**
 * Fábricas de adaptadores por driver configurado en NOTIFICATION_CHANNEL_DRIVER.
 * Para añadir un proveedor, agrega una entrada aquí.
 */
const DRIVERS = Object.freeze({
  log: (canal) => new LogChannelAdapter(canal),
});

/**
 * Crea los adaptadores de canal de entrega.
 * @param {string} driver - Nombre del driver ('log').
 * @returns {{ email: import('./channel.adapter'), push: import('./channel.adapter') }}
 */
const createChannelAdapters = (driver) => {
  const build = DRIVERS[driver];
  if (!build) {
    throw new Error(`Driver de canal no soportado: ${driver}`);
  }
  return {
    email: build('email'),
    push: build('push'),
  };
};

module.exports = { createChannelAdapters };
