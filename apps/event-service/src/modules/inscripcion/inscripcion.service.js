const crypto = require('node:crypto');

const {
  ConflictError, ForbiddenError, NotFoundError,
} = require('../../core/exceptions');

const ADMIN_ROLES = ['SUPERADMIN', 'ADMIN', 'STAFF'];

function isAdmin(user) {
  return user.roles.some((role) => ADMIN_ROLES.includes(role));
}

class InscripcionService {
  constructor(
    inscripcionRepository,
    eventoRepository,
    estadoRepository,
    notificationProducer = null,
  ) {
    this.inscripcionRepository = inscripcionRepository;
    this.eventoRepository = eventoRepository;
    this.estadoRepository = estadoRepository;
    this.notificationProducer = notificationProducer;
  }

  async notifyRegistrant(registration, evento, eventType) {
    if (!this.notificationProducer) return;
    try {
      await this.notificationProducer.notify(eventType, {
        recipientUuid: registration.registrantUuid,
        recipientName: registration.registrantName,
        entityId: registration.id,
        entityUuid: registration.uuid,
        referenceLabel: evento.title,
      });
    } catch (error) {
      // La notificación es best-effort: nunca debe tumbar la inscripción.
    }
  }

  async register(eventId, registrant) {
    const evento = await this.eventoRepository.findById(eventId);
    if (!evento) {
      throw new NotFoundError('Event not found');
    }

    if (!evento.requiresRegistration) {
      throw new ConflictError('This event does not require registration');
    }

    const status = await this.estadoRepository.findById(evento.statusId);
    if (!status || status.code !== 'published') {
      throw new ConflictError('Registration is only open while the event is published');
    }

    if (evento.registrationDeadline && new Date() > new Date(evento.registrationDeadline)) {
      throw new ConflictError('Registration deadline has passed');
    }

    const existing = await this.inscripcionRepository.findByEventAndRegistrant(
      eventId,
      registrant.uuid,
    );
    if (existing && existing.status !== 'cancelled') {
      throw new ConflictError('You are already registered for this event');
    }

    const confirmedCount = await this.inscripcionRepository.countByStatus(eventId, 'confirmed');
    const hasCapacity = !evento.maxCapacity || confirmedCount < evento.maxCapacity;
    const newStatus = hasCapacity ? 'confirmed' : 'waitlisted';
    const qrCode = hasCapacity ? crypto.randomBytes(16).toString('hex') : null;

    const eventType = newStatus === 'confirmed' ? 'inscripcion_confirmada' : 'inscripcion_lista_espera';

    if (existing) {
      // Estaba cancelada: se reactiva en vez de violar la UNIQUE KEY (event_id, registrant_uuid).
      const reactivated = await this.inscripcionRepository.updateStatus(existing.id, {
        status: newStatus,
        confirmedAt: newStatus === 'confirmed' ? new Date() : null,
        cancelledAt: null,
        qrCode,
      });
      await this.notifyRegistrant(reactivated, evento, eventType);
      return reactivated;
    }

    const created = await this.inscripcionRepository.create({
      eventId,
      registrantUuid: registrant.uuid,
      registrantName: registrant.nombre || registrant.uuid,
      status: newStatus,
      qrCode,
    });
    await this.notifyRegistrant(created, evento, eventType);
    return created;
  }

  async findMine(eventId, registrant) {
    const registration = await this.inscripcionRepository.findByEventAndRegistrant(
      eventId,
      registrant.uuid,
    );
    if (!registration) {
      throw new NotFoundError('You are not registered for this event');
    }
    return registration;
  }

  async findByEventId(eventId) {
    const evento = await this.eventoRepository.findById(eventId);
    if (!evento) {
      throw new NotFoundError('Event not found');
    }
    return this.inscripcionRepository.findByEventId(eventId);
  }

  async cancel(eventId, actor) {
    const registration = await this.inscripcionRepository.findByEventAndRegistrant(
      eventId,
      actor.uuid,
    );
    if (!registration) {
      throw new NotFoundError('You are not registered for this event');
    }
    if (registration.status === 'cancelled') {
      throw new ConflictError('Registration is already cancelled');
    }

    const wasConfirmed = registration.status === 'confirmed';
    const updated = await this.inscripcionRepository.updateStatus(registration.id, {
      status: 'cancelled',
      cancelledAt: new Date(),
    });

    // Al liberar un cupo confirmado, se promueve automáticamente a la
    // persona más antigua en lista de espera.
    if (wasConfirmed) {
      const nextInLine = await this.inscripcionRepository.findOldestWaitlisted(eventId);
      if (nextInLine) {
        const promoted = await this.inscripcionRepository.updateStatus(nextInLine.id, {
          status: 'confirmed',
          confirmedAt: new Date(),
          qrCode: crypto.randomBytes(16).toString('hex'),
        });
        const evento = await this.eventoRepository.findById(eventId);
        await this.notifyRegistrant(promoted, evento, 'inscripcion_promovida');
      }
    }

    return updated;
  }

  async checkIn(registrationId, actor) {
    if (!isAdmin(actor)) {
      throw new ForbiddenError('Only staff can check in attendees');
    }

    const registration = await this.inscripcionRepository.findById(registrationId);
    if (!registration) {
      throw new NotFoundError('Registration not found');
    }
    if (registration.status !== 'confirmed') {
      throw new ConflictError('Only confirmed registrations can be checked in');
    }

    return this.inscripcionRepository.updateStatus(registrationId, {
      status: 'attended',
      attendedAt: new Date(),
    });
  }
}

module.exports = InscripcionService;
