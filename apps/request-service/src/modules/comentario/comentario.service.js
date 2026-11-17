const { ForbiddenError, NotFoundError } = require('../../core/exceptions');

const ADMIN_ROLES = ['SUPERADMIN', 'ADMIN', 'STAFF'];

function isAdmin(user) {
  return user.roles.some((role) => ADMIN_ROLES.includes(role));
}

class ComentarioService {
  constructor(comentarioRepository, solicitudService) {
    this.comentarioRepository = comentarioRepository;
    this.solicitudService = solicitudService;
  }

  async create(requestId, dto, author) {
    // findById ya valida que la solicitud existe y que el autor tiene
    // acceso a ella (dueño, asignado o admin/staff).
    await this.solicitudService.findById(requestId, author);

    if (dto.isInternal && !isAdmin(author)) {
      throw new ForbiddenError('Only staff can post internal comments');
    }

    return this.comentarioRepository.create({
      requestId,
      authorUuid: author.uuid,
      authorName: author.nombre || author.uuid,
      body: dto.body,
      isInternal: Boolean(dto.isInternal),
    });
  }

  async findByRequestId(requestId, requester) {
    await this.solicitudService.findById(requestId, requester);
    return this.comentarioRepository.findByRequestId(requestId, {
      includeInternal: isAdmin(requester),
    });
  }

  async delete(id, actor) {
    const comment = await this.comentarioRepository.findById(id);
    if (!comment) {
      throw new NotFoundError('Comment not found');
    }
    if (comment.authorUuid !== actor.uuid && !isAdmin(actor)) {
      throw new ForbiddenError('You can only delete your own comments');
    }
    await this.comentarioRepository.delete(id);
  }
}

module.exports = ComentarioService;
