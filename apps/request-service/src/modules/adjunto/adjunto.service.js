const { getFile } = require('../../clients/storage.client');
const { ForbiddenError, NotFoundError } = require('../../core/exceptions');

const ADMIN_ROLES = ['SUPERADMIN', 'ADMIN', 'STAFF'];

function isAdmin(user) {
  return user.roles.some((role) => ADMIN_ROLES.includes(role));
}

class AdjuntoService {
  constructor(adjuntoRepository, solicitudService) {
    this.adjuntoRepository = adjuntoRepository;
    this.solicitudService = solicitudService;
  }

  async create(requestId, dto, uploader) {
    // findById valida que la solicitud existe y que el uploader tiene
    // acceso a ella (dueño, asignado o admin/staff).
    await this.solicitudService.findById(requestId, uploader);

    // getFile se autentica como `uploader`: si el archivo no existe o no le
    // pertenece (y no es admin/staff), storage-service lo rechaza y esto
    // devuelve null — así nadie puede enganchar un archivo ajeno.
    const file = await getFile(dto.fileId, uploader);
    if (!file) {
      throw new NotFoundError('File not found or not accessible');
    }

    return this.adjuntoRepository.create({
      requestId,
      uploaderUuid: uploader.uuid,
      fileUuid: file.uuid,
      originalName: file.originalName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
    });
  }

  async findByRequestId(requestId, requester) {
    await this.solicitudService.findById(requestId, requester);
    return this.adjuntoRepository.findByRequestId(requestId);
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
