const crypto = require('node:crypto');

const { checkResourceAvailability, getResource } = require('../../clients/resource.client');
const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const { ConflictError, ForbiddenError, NotFoundError } = require('../../core/exceptions');

const ADMIN_ROLES = ['SUPERADMIN', 'ADMIN', 'STAFF'];

function isAdmin(user) {
  return user.roles.some((role) => ADMIN_ROLES.includes(role));
}

function generateReferenceNumber() {
  const year = new Date().getFullYear();
  const suffix = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `BK-${year}-${suffix}`;
}

class ReservaService {
  constructor(
    reservaRepository,
    auditoriaRepository,
    tipoRepository,
    estadoRepository,
    notificationProducer = null,
  ) {
    this.reservaRepository = reservaRepository;
    this.auditoriaRepository = auditoriaRepository;
    this.tipoRepository = tipoRepository;
    this.estadoRepository = estadoRepository;
    this.notificationProducer = notificationProducer;
  }

  async requireStatusByCode(code) {
    const estado = await this.estadoRepository.findByCode(code);
    if (!estado) {
      throw new NotFoundError(`Booking status '${code}' is not configured`);
    }
    return estado;
  }

  async create(dto, requester) {
    const tipo = await this.tipoRepository.findById(dto.bookingTypeId);
    if (!tipo) {
      throw new NotFoundError('Booking type not found');
    }

    const resource = await getResource(dto.resourceId);
    if (!resource) {
      throw new NotFoundError('Resource not found');
    }

    const availability = await checkResourceAvailability(dto.resourceId, {
      date: dto.bookingDate,
      startTime: dto.startTime,
      endTime: dto.endTime,
    });
    if (!availability.available) {
      throw new ConflictError(`Resource is not available: ${availability.reason}`);
    }

    const overlapping = await this.reservaRepository.findOverlapping(
      resource.uuid,
      dto.bookingDate,
      dto.startTime,
      dto.endTime,
    );
    if (overlapping) {
      throw new ConflictError('Resource already has a booking for this time range');
    }

    const initialStatus = await this.requireStatusByCode(tipo.requiresApproval ? 'pending' : 'approved');

    const booking = await this.reservaRepository.create({
      referenceNumber: generateReferenceNumber(),
      bookingTypeId: tipo.id,
      statusId: initialStatus.id,
      resourceUuid: resource.uuid,
      resourceName: resource.name,
      requesterUuid: requester.uuid,
      requesterName: requester.nombre || requester.uuid,
      title: dto.title,
      description: dto.description,
      bookingDate: dto.bookingDate,
      startTime: dto.startTime,
      endTime: dto.endTime,
      expectedAttendees: dto.expectedAttendees,
      metadata: dto.metadata,
    });

    await this.auditoriaRepository.record({
      bookingId: booking.id,
      fromStatusId: null,
      toStatusId: initialStatus.id,
      actorUuid: requester.uuid,
      actorName: requester.nombre || requester.uuid,
      comment: 'Solicitud creada',
    });

    await this.indexEntity(booking);

    return booking;
  }

  async findAll(requester, {
    page = 1, limit = 10, statusId, resourceUuid,
  } = {}) {
    const requesterUuid = isAdmin(requester) ? undefined : requester.uuid;
    return this.reservaRepository.findAll({
      page, limit, requesterUuid, statusId, resourceUuid,
    });
  }

  async findById(id, requester) {
    const booking = await this.reservaRepository.findById(id);
    if (!booking) {
      throw new NotFoundError('Booking not found');
    }
    this.assertCanAccess(booking, requester);
    return booking;
  }

  async findHistory(id, requester) {
    await this.findById(id, requester);
    return this.auditoriaRepository.findByBookingId(id);
  }

  assertCanAccess(booking, requester) {
    if (booking.requesterUuid !== requester.uuid && !isAdmin(requester)) {
      throw new ForbiddenError('You do not have access to this booking');
    }
  }

  async transition(id, actor, {
    fromCodes, toCode, timestampField, extraFields = {}, comment,
  }) {
    const booking = await this.reservaRepository.findById(id);
    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    const currentStatus = await this.estadoRepository.findById(booking.statusId);
    if (!fromCodes.includes(currentStatus.code)) {
      throw new ConflictError(
        `Cannot transition from '${currentStatus.code}' to '${toCode}'`,
      );
    }

    const nextStatus = await this.requireStatusByCode(toCode);

    const updated = await this.reservaRepository.updateStatus(id, {
      statusId: nextStatus.id,
      [timestampField]: new Date(),
      ...extraFields,
    });

    await this.auditoriaRepository.record({
      bookingId: id,
      fromStatusId: currentStatus.id,
      toStatusId: nextStatus.id,
      actorUuid: actor.uuid,
      actorName: actor.nombre || actor.uuid,
      comment,
    });

    await this.indexEntity(updated);
    await this.notifyRecipient(updated, `reserva_${toCode}`, comment);

    return updated;
  }

  async notifyRecipient(booking, eventType, comment) {
    if (!this.notificationProducer) return;
    try {
      await this.notificationProducer.notify(eventType, {
        recipientUuid: booking.requesterUuid,
        recipientName: booking.requesterName,
        entityId: booking.id,
        entityUuid: booking.uuid,
        referenceLabel: booking.referenceNumber,
        comment,
      });
    } catch (error) {
      // La notificación es best-effort: nunca debe tumbar la transición.
    }
  }

  async approve(id, actor) {
    return this.transition(id, actor, {
      fromCodes: ['pending'],
      toCode: 'approved',
      timestampField: 'approvedAt',
      extraFields: { approverUuid: actor.uuid },
      comment: 'Reserva aprobada',
    });
  }

  async reject(id, actor, reason) {
    return this.transition(id, actor, {
      fromCodes: ['pending'],
      toCode: 'rejected',
      timestampField: 'cancelledAt',
      extraFields: { approverUuid: actor.uuid, cancellationReason: reason },
      comment: reason,
    });
  }

  async confirm(id, actor) {
    return this.transition(id, actor, {
      fromCodes: ['approved'],
      toCode: 'confirmed',
      timestampField: 'approvedAt',
      comment: 'Reserva confirmada',
    });
  }

  async cancel(id, actor, reason) {
    const booking = await this.reservaRepository.findById(id);
    if (!booking) {
      throw new NotFoundError('Booking not found');
    }
    this.assertCanAccess(booking, actor);

    return this.transition(id, actor, {
      fromCodes: ['pending', 'approved', 'confirmed'],
      toCode: 'cancelled',
      timestampField: 'cancelledAt',
      extraFields: { cancellationReason: reason },
      comment: reason,
    });
  }

  async complete(id, actor) {
    return this.transition(id, actor, {
      fromCodes: ['confirmed'],
      toCode: 'completed',
      timestampField: 'completedAt',
      comment: 'Reserva completada',
    });
  }

  async indexEntity(booking) {
    try {
      await esClient.index({
        index: env.BOOKING_INDEX,
        id: booking.uuid,
        document: {
          id: booking.id,
          uuid: booking.uuid,
          referenceNumber: booking.referenceNumber,
          title: booking.title,
          resourceUuid: booking.resourceUuid,
          requesterUuid: booking.requesterUuid,
          estado: String(booking.statusId),
          bookingDate: booking.bookingDate,
          createdAt: booking.createdAt,
          updatedAt: booking.updatedAt,
        },
      });
    } catch (error) {
      // ES indexing is non-blocking
    }
  }
}

module.exports = ReservaService;
