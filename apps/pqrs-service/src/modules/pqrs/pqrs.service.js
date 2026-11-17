const crypto = require('node:crypto');

const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const {
  ConflictError, ForbiddenError, NotFoundError,
} = require('../../core/exceptions');

const ADMIN_ROLES = ['SUPERADMIN', 'ADMIN', 'STAFF'];

function isAdmin(user) {
  return user.roles.some((role) => ADMIN_ROLES.includes(role));
}

function generateTicketNumber() {
  const year = new Date().getFullYear();
  const suffix = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `PQRS-${year}-${suffix}`;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result.toISOString().slice(0, 10);
}

class PqrsService {
  constructor(
    pqrsRepository,
    auditoriaRepository,
    respuestaRepository,
    tipoRepository,
    estadoRepository,
    notificationProducer = null,
  ) {
    this.pqrsRepository = pqrsRepository;
    this.auditoriaRepository = auditoriaRepository;
    this.respuestaRepository = respuestaRepository;
    this.tipoRepository = tipoRepository;
    this.estadoRepository = estadoRepository;
    this.notificationProducer = notificationProducer;
  }

  /**
   * Best-effort: si la PQRS es anónima, requesterUuid es null y el
   * consumidor de notification-service descarta el evento sin destinatario
   * (ver domain-events.consumer.js) — nunca falla por eso.
   */
  async notifyRecipient(pqrs, eventType, comment) {
    if (!this.notificationProducer) return;
    try {
      await this.notificationProducer.notify(eventType, {
        recipientUuid: pqrs.requesterUuid,
        recipientName: pqrs.requesterName,
        entityId: pqrs.id,
        entityUuid: pqrs.uuid,
        referenceLabel: pqrs.ticketNumber,
        comment,
      });
    } catch (error) {
      // La notificación es best-effort: nunca debe tumbar la transición.
    }
  }

  async requireStatusByCode(code) {
    const estado = await this.estadoRepository.findByCode(code);
    if (!estado) {
      throw new NotFoundError(`PQRS status '${code}' is not configured`);
    }
    return estado;
  }

  async create(dto, requester) {
    const tipo = await this.tipoRepository.findById(dto.typeId);
    if (!tipo) {
      throw new NotFoundError('PQRS type not found');
    }

    const initialStatus = await this.requireStatusByCode('pending');
    const dueDate = addDays(new Date(), tipo.slaDays);
    const isAnonymous = Boolean(dto.isAnonymous);

    const pqrs = await this.pqrsRepository.create({
      ticketNumber: generateTicketNumber(),
      typeId: tipo.id,
      statusId: initialStatus.id,
      isAnonymous,
      requesterUuid: isAnonymous ? null : requester.uuid,
      requesterName: isAnonymous ? null : (requester.nombre || requester.uuid),
      contactEmail: dto.contactEmail,
      subject: dto.subject,
      description: dto.description,
      campusUuid: dto.campusUuid,
      campusName: dto.campusName,
      dueDate,
    });

    // Si es anónima, no se deja rastro de quién la radicó ni en la
    // auditoría: la anonimidad aplica también frente al personal interno.
    if (!isAnonymous) {
      await this.auditoriaRepository.record({
        pqrsId: pqrs.id,
        fromStatusId: null,
        toStatusId: initialStatus.id,
        actorUuid: requester.uuid,
        actorName: requester.nombre || requester.uuid,
        comment: 'PQRS radicada',
      });
    }

    await this.indexEntity(pqrs);
    if (!isAnonymous) {
      await this.notifyRecipient(pqrs, 'pqrs_creada', 'PQRS radicada');
    }

    return pqrs;
  }

  async findAll(requester, {
    page = 1, limit = 10, statusId, typeId, assigneeUuid,
  } = {}) {
    const requesterUuid = isAdmin(requester) ? undefined : requester.uuid;
    return this.pqrsRepository.findAll({
      page, limit, requesterUuid, assigneeUuid, statusId, typeId,
    });
  }

  async findById(id, requester) {
    const pqrs = await this.pqrsRepository.findById(id);
    if (!pqrs) {
      throw new NotFoundError('PQRS not found');
    }
    this.assertCanAccess(pqrs, requester);
    return pqrs;
  }

  /**
   * El número de radicado es en sí mismo la credencial de consulta: permite
   * que quien radicó una PQRS anónima (sin requester_uuid almacenado) pueda
   * igual hacerle seguimiento, sin necesidad de exponerla en los listados.
   */
  async findByTicketNumber(ticketNumber) {
    const pqrs = await this.pqrsRepository.findByTicketNumber(ticketNumber);
    if (!pqrs) {
      throw new NotFoundError('PQRS not found');
    }
    return pqrs;
  }

  async findHistory(id, requester) {
    await this.findById(id, requester);
    return this.auditoriaRepository.findByPqrsId(id);
  }

  async findResponses(id, requester) {
    await this.findById(id, requester);
    return this.respuestaRepository.findByPqrsId(id);
  }

  assertCanAccess(pqrs, requester) {
    const isOwner = pqrs.requesterUuid === requester.uuid;
    const isAssignee = pqrs.assigneeUuid === requester.uuid;
    if (!isOwner && !isAssignee && !isAdmin(requester)) {
      throw new ForbiddenError('You do not have access to this PQRS');
    }
  }

  async transition(id, actor, {
    fromCodes, toCode, extraFields = {}, comment,
  }) {
    const pqrs = await this.pqrsRepository.findById(id);
    if (!pqrs) {
      throw new NotFoundError('PQRS not found');
    }

    const currentStatus = await this.estadoRepository.findById(pqrs.statusId);
    if (!fromCodes.includes(currentStatus.code)) {
      throw new ConflictError(`Cannot transition from '${currentStatus.code}' to '${toCode}'`);
    }

    const nextStatus = await this.requireStatusByCode(toCode);

    const updated = await this.pqrsRepository.updateStatus(id, {
      statusId: nextStatus.id,
      ...extraFields,
    });

    await this.auditoriaRepository.record({
      pqrsId: id,
      fromStatusId: currentStatus.id,
      toStatusId: nextStatus.id,
      actorUuid: actor.uuid,
      actorName: actor.nombre || actor.uuid,
      comment,
    });

    await this.indexEntity(updated);
    await this.notifyRecipient(updated, `pqrs_${toCode}`, comment);

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

  async respond(id, actor, dto) {
    const pqrs = await this.transition(id, actor, {
      fromCodes: ['pending', 'in_review'],
      toCode: 'responded',
      extraFields: { respondedAt: new Date() },
      comment: 'PQRS respondida',
    });

    const respuesta = await this.respuestaRepository.create({
      pqrsId: id,
      authorUuid: actor.uuid,
      authorName: actor.nombre || actor.uuid,
      body: dto.body,
      isFinal: true,
    });

    return { pqrs, respuesta };
  }

  async close(id, actor) {
    return this.transition(id, actor, {
      fromCodes: ['responded'],
      toCode: 'closed',
      extraFields: { closedAt: new Date() },
      comment: 'PQRS cerrada',
    });
  }

  async indexEntity(pqrs) {
    try {
      await esClient.index({
        index: env.PQRS_INDEX,
        id: pqrs.uuid,
        document: {
          id: pqrs.id,
          uuid: pqrs.uuid,
          ticketNumber: pqrs.ticketNumber,
          subject: pqrs.subject,
          typeId: pqrs.typeId,
          requesterUuid: pqrs.requesterUuid,
          assigneeUuid: pqrs.assigneeUuid,
          isAnonymous: Boolean(pqrs.isAnonymous),
          estado: String(pqrs.statusId),
          dueDate: pqrs.dueDate,
          createdAt: pqrs.createdAt,
          updatedAt: pqrs.updatedAt,
        },
      });
    } catch (error) {
      // ES indexing is non-blocking
    }
  }
}

module.exports = PqrsService;
