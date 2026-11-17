const crypto = require('node:crypto');

const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const { ConflictError, ForbiddenError, NotFoundError } = require('../../core/exceptions');

const ADMIN_ROLES = ['SUPERADMIN', 'ADMIN', 'STAFF'];

function isAdmin(user) {
  return user.roles.some((role) => ADMIN_ROLES.includes(role));
}

function generateTicketNumber() {
  const year = new Date().getFullYear();
  const suffix = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `REQ-${year}-${suffix}`;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result.toISOString().slice(0, 10);
}

class SolicitudService {
  constructor(
    solicitudRepository,
    auditoriaRepository,
    tipoRepository,
    estadoRepository,
    notificationProducer = null,
  ) {
    this.solicitudRepository = solicitudRepository;
    this.auditoriaRepository = auditoriaRepository;
    this.tipoRepository = tipoRepository;
    this.estadoRepository = estadoRepository;
    this.notificationProducer = notificationProducer;
  }

  async notifyRecipient(solicitud, eventType, comment) {
    if (!this.notificationProducer) return;
    try {
      await this.notificationProducer.notify(eventType, {
        recipientUuid: solicitud.requesterUuid,
        recipientName: solicitud.requesterName,
        entityId: solicitud.id,
        entityUuid: solicitud.uuid,
        referenceLabel: solicitud.ticketNumber,
        comment,
      });
    } catch (error) {
      // La notificación es best-effort: nunca debe tumbar la transición.
    }
  }

  async requireStatusByCode(code) {
    const estado = await this.estadoRepository.findByCode(code);
    if (!estado) {
      throw new NotFoundError(`Request status '${code}' is not configured`);
    }
    return estado;
  }

  async create(dto, requester) {
    const tipo = await this.tipoRepository.findById(dto.requestTypeId);
    if (!tipo) {
      throw new NotFoundError('Request type not found');
    }

    const initialStatus = await this.requireStatusByCode('pending');
    const dueDate = tipo.slaDays ? addDays(new Date(), tipo.slaDays) : null;

    const solicitud = await this.solicitudRepository.create({
      ticketNumber: generateTicketNumber(),
      requestTypeId: tipo.id,
      statusId: initialStatus.id,
      requesterUuid: requester.uuid,
      requesterName: requester.nombre || requester.uuid,
      title: dto.title,
      description: dto.description,
      formData: dto.formData,
      dueDate,
    });

    await this.auditoriaRepository.record({
      requestId: solicitud.id,
      fromStatusId: null,
      toStatusId: initialStatus.id,
      actorUuid: requester.uuid,
      actorName: requester.nombre || requester.uuid,
      comment: 'Solicitud creada',
    });

    await this.indexEntity(solicitud);
    await this.notifyRecipient(solicitud, 'solicitud_creada', 'Solicitud creada');

    return solicitud;
  }

  async findAll(requester, {
    page = 1, limit = 10, statusId, assigneeUuid,
  } = {}) {
    const requesterUuid = isAdmin(requester) ? undefined : requester.uuid;
    return this.solicitudRepository.findAll({
      page, limit, requesterUuid, assigneeUuid, statusId,
    });
  }

  async findById(id, requester) {
    const solicitud = await this.solicitudRepository.findById(id);
    if (!solicitud) {
      throw new NotFoundError('Request not found');
    }
    this.assertCanAccess(solicitud, requester);
    return solicitud;
  }

  async findHistory(id, requester) {
    await this.findById(id, requester);
    return this.auditoriaRepository.findByRequestId(id);
  }

  assertCanAccess(solicitud, requester) {
    const isOwner = solicitud.requesterUuid === requester.uuid;
    const isAssignee = solicitud.assigneeUuid === requester.uuid;
    if (!isOwner && !isAssignee && !isAdmin(requester)) {
      throw new ForbiddenError('You do not have access to this request');
    }
  }

  async transition(id, actor, {
    fromCodes, toCode, extraFields = {}, comment,
  }) {
    const solicitud = await this.solicitudRepository.findById(id);
    if (!solicitud) {
      throw new NotFoundError('Request not found');
    }

    const currentStatus = await this.estadoRepository.findById(solicitud.statusId);
    if (!fromCodes.includes(currentStatus.code)) {
      throw new ConflictError(`Cannot transition from '${currentStatus.code}' to '${toCode}'`);
    }

    const nextStatus = await this.requireStatusByCode(toCode);

    const updated = await this.solicitudRepository.updateStatus(id, {
      statusId: nextStatus.id,
      ...extraFields,
    });

    await this.auditoriaRepository.record({
      requestId: id,
      fromStatusId: currentStatus.id,
      toStatusId: nextStatus.id,
      actorUuid: actor.uuid,
      actorName: actor.nombre || actor.uuid,
      comment,
    });

    await this.indexEntity(updated);
    await this.notifyRecipient(updated, `solicitud_${toCode}`, comment);

    return updated;
  }

  async startReview(id, actor) {
    return this.transition(id, actor, {
      fromCodes: ['pending'],
      toCode: 'in_review',
      extraFields: { assigneeUuid: actor.uuid, assigneeName: actor.nombre || actor.uuid },
      comment: 'En revisión',
    });
  }

  async approve(id, actor, resolutionNotes) {
    return this.transition(id, actor, {
      fromCodes: ['in_review'],
      toCode: 'approved',
      extraFields: { resolutionNotes, resolvedAt: new Date() },
      comment: resolutionNotes,
    });
  }

  async reject(id, actor, resolutionNotes) {
    return this.transition(id, actor, {
      fromCodes: ['in_review'],
      toCode: 'rejected',
      extraFields: { resolutionNotes, resolvedAt: new Date() },
      comment: resolutionNotes,
    });
  }

  async close(id, actor) {
    return this.transition(id, actor, {
      fromCodes: ['approved', 'rejected'],
      toCode: 'closed',
      comment: 'Solicitud cerrada',
    });
  }

  async indexEntity(solicitud) {
    try {
      await esClient.index({
        index: env.REQUEST_INDEX,
        id: solicitud.uuid,
        document: {
          id: solicitud.id,
          uuid: solicitud.uuid,
          ticketNumber: solicitud.ticketNumber,
          title: solicitud.title,
          requesterUuid: solicitud.requesterUuid,
          assigneeUuid: solicitud.assigneeUuid,
          estado: String(solicitud.statusId),
          dueDate: solicitud.dueDate,
          createdAt: solicitud.createdAt,
          updatedAt: solicitud.updatedAt,
        },
      });
    } catch (error) {
      // ES indexing is non-blocking
    }
  }
}

module.exports = SolicitudService;
