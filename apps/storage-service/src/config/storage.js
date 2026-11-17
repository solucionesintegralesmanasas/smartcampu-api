const fsSync = require('node:fs');
const fs = require('node:fs/promises');
const path = require('node:path');

const { env } = require('./env');

const baseDir = path.isAbsolute(env.STORAGE_PATH)
  ? env.STORAGE_PATH
  : path.join(__dirname, '..', '..', env.STORAGE_PATH);

async function ensureBaseDir() {
  await fs.mkdir(baseDir, { recursive: true });
}

/**
 * Driver de almacenamiento local (disco). `storedName` es siempre un nombre
 * generado por el servidor (UUID + extensión) — nunca el nombre original del
 * cliente — así que no hay riesgo de path traversal al construir la ruta.
 */
const localDriver = {
  name: 'local',

  async save(storedName, buffer) {
    await ensureBaseDir();
    await fs.writeFile(path.join(baseDir, storedName), buffer);
  },

  async read(storedName) {
    return fs.readFile(path.join(baseDir, storedName));
  },

  createReadStream(storedName) {
    return fsSync.createReadStream(path.join(baseDir, storedName));
  },

  async delete(storedName) {
    try {
      await fs.unlink(path.join(baseDir, storedName));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  },
};

// Registro de drivers disponibles. Agregar uno nuevo (p. ej. 's3') solo
// requiere implementar esta misma interfaz (save/read/createReadStream/delete)
// y sumarlo aquí — el resto del servicio (repository/service) no cambia.
const drivers = { local: localDriver };

function getStorageDriver() {
  return drivers[env.STORAGE_DRIVER];
}

module.exports = { getStorageDriver };
