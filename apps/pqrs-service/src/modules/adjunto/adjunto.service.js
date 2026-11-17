const { getFile } = require('../../clients/storage.client');
const { ForbiddenError, NotFoundError } = require('../../core/exceptions');

const ADMIN_ROLES = ['SUPERADMIN', 'ADMIN', 'STAFF'];

function isAdmin(user) {
  return user.roles.some((role) => ADMIN_ROLES.includes(role));
}

class AdjuntoService {
  constructor(adjuntoRepository, pqrsService) {
    this.adjuntoRepository = adjuntoRepository;
    this.pqrsService = pqrsService;
  }

  async create(pqrsId, dto, uploader) {
    // findById ya valida que la PQRS existe y que el uploader tiene
    // acceso a ella (dueño, asignado o admin/staff).
    const pqrs = await this.pqrsService.findById(pqrsId, uploader);

    // getFile se autentica como `uploader`: si el archivo no existe o no le
    // pertenece (y no es admin/staff), storage-service lo rechaza y esto
    // devuelve null — así nadie puede enganchar un archivo ajeno.
    const file = await getFile(dto.fileId, uploader);
    if (!file) {
      throw new NotFoundError('File not found or not accessible');
    }

    return this.adjuntoRepository.create({
      pqrsId,
      uploaderUuid: pqrs.isAnonymous ? null : uploader.uuid,
      fileUuid: file.uuid,
      originalName: file.originalName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
    });
  }

  async findByPqrsId(pqrsId, requester) {
    await this.pqrsService.findById(pqrsId, requester);
    return this.adjuntoRepository.findByPqrsId(pqrsId);
  }

  async delete(id, actor) {
    const attachment = await this.adjuntoRepository.findById(id);
    if (!attachment) {
      throw new NotFoundError('Attachment not found');
    }
    if (attachment.uploaderUuid !== actor.uuid && !isAdmin(actor)) {
      throw new ForbiddenError('You can only remove your own attachments');
    }
    await this.adjuntoRepository.delete(id);
  }
}

module.exports = AdjuntoService;
