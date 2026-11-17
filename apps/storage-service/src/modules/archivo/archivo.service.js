const crypto = require('node:crypto');
const path = require('node:path');

const { v4: uuidv4 } = require('uuid');

const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const { getStorageDriver } = require('../../config/storage');
const { ForbiddenError, NotFoundError } = require('../../core/exceptions');

const ADMIN_ROLES = ['SUPERADMIN', 'ADMIN', 'STAFF'];

function isAdmin(user) {
  return user.roles.some((role) => ADMIN_ROLES.includes(role));
}

class ArchivoService {
  constructor(archivoRepository) {
    this.archivoRepository = archivoRepository;
    this.driver = getStorageDriver();
  }

  async upload(file, uploader, { ownerType, ownerReferenceUuid, metadata } = {}) {
    const ext = path.extname(file.originalname).toLowerCase();
    const storedName = `${uuidv4()}${ext}`;
    const checksumSha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');

    await this.driver.save(storedName, file.buffer);

    const archivo = await this.archivoRepository.create({
      originalName: file.originalname,
      storedName,
      storageDriver: this.driver.name,
      storagePath: storedName,
      mimeType: file.mimetype,
      extension: ext,
      sizeBytes: file.size,
      checksumSha256,
      ownerUserUuid: uploader.uuid,
      ownerType,
      ownerReferenceUuid,
      metadata,
    });

    await this.indexEntity(archivo);

    return archivo;
  }

  async findAll(requester, { page = 1, limit = 10, ownerType } = {}) {
    const ownerUserUuid = isAdmin(requester) ? undefined : requester.uuid;
    return this.archivoRepository.findAll({
      page, limit, ownerUserUuid, ownerType,
    });
  }

  async findById(id, requester) {
    const archivo = await this.archivoRepository.findById(id);
    if (!archivo) {
      throw new NotFoundError('File not found');
    }
    this.assertCanAccess(archivo, requester);
    return archivo;
  }

  async download(id, requester) {
    const archivo = await this.findById(id, requester);
    const stream = this.driver.createReadStream(archivo.storagePath);
    return { archivo, stream };
  }

  async delete(id, requester) {
    const archivo = await this.findById(id, requester);

    await this.archivoRepository.delete(id);
    await this.driver.delete(archivo.storagePath);

    try {
      await esClient.delete({ index: env.STORAGE_INDEX, id: archivo.uuid });
    } catch (error) {
      // ES delete is non-blocking
    }
  }

  assertCanAccess(archivo, requester) {
    if (archivo.ownerUserUuid !== requester.uuid && !isAdmin(requester)) {
      throw new ForbiddenError('You do not have access to this file');
    }
  }

  async indexEntity(archivo) {
    try {
      await esClient.index({
        index: env.STORAGE_INDEX,
        id: archivo.uuid,
        document: {
          id: archivo.id,
          uuid: archivo.uuid,
          originalName: archivo.originalName,
          mimeType: archivo.mimeType,
          extension: archivo.extension,
          sizeBytes: archivo.sizeBytes,
          ownerUserUuid: archivo.ownerUserUuid,
          ownerType: archivo.ownerType,
          ownerReferenceUuid: archivo.ownerReferenceUuid,
          estado: archivo.isActive ? 'active' : 'inactive',
          createdAt: archivo.createdAt,
          updatedAt: archivo.updatedAt,
        },
      });
    } catch (error) {
      // ES indexing is non-blocking
    }
  }
}

module.exports = ArchivoService;
