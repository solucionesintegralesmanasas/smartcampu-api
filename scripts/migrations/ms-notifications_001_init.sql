-- ============================================================
-- BASE DE DATOS: uajs_notifications
-- Microservicio: ms-notifications
-- Descripción: Entrega de notificaciones multicanal — in-app,
--              correo electrónico, push. Recibe eventos de otros
--              microservicios vía cola de mensajes (BullMQ).
-- Versión: 1.0.0
-- Autor: Darwin Montes
-- ============================================================

CREATE DATABASE IF NOT EXISTS uajs_notifications
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE uajs_notifications;

SET FOREIGN_KEY_CHECKS = 0;
SET time_zone = '+00:00';

-- ------------------------------------------------------------
-- notification_templates
-- Plantillas de mensajes reutilizables con interpolación de variables
-- Admite sintaxis estilo Handlebars {{ variable }}
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_templates (
    id              INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid            CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    code            VARCHAR(60)     NOT NULL COMMENT 'Código, ej. booking.approved, request.status_changed',
    name            VARCHAR(100)    NOT NULL COMMENT 'Nombre descriptivo de la plantilla',
    channel         ENUM('in_app','email','push','sms') NOT NULL COMMENT 'Canal: in_app=En app, email=Correo, push=Push, sms=SMS',
    subject         VARCHAR(200)    NULL COMMENT 'Asunto del correo (con interpolación)',
    body_text       TEXT            NULL COMMENT 'Cuerpo en texto plano',
    body_html       MEDIUMTEXT      NULL COMMENT 'Cuerpo en HTML (solo correo)',
    variables       JSON            NULL COMMENT 'Nombres y tipos de variables esperados',
    is_active       TINYINT(1)      NOT NULL DEFAULT 1 COMMENT 'Registro activo (1) o inactivo (0)',
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de última modificación',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_notification_templates_uuid         (uuid),
    UNIQUE KEY uq_notification_templates_code_channel (code, channel)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Plantillas de notificaciones reutilizables por canal';

-- ------------------------------------------------------------
-- notifications
-- Registros individuales de notificación enviados a un único destinatario
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid            CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    template_id     INT UNSIGNED    NULL     COMMENT 'Plantilla usada (NULL para notificaciones ad-hoc)',
    -- recipient (cross-service)
    recipient_uuid  CHAR(36)        NOT NULL COMMENT 'Referencia a auth.users.uuid',
    recipient_email VARCHAR(150)    NULL COMMENT 'Correo del destinatario',
    -- delivery
    channel         ENUM('in_app','email','push','sms') NOT NULL COMMENT 'Canal: in_app=En app, email=Correo, push=Push, sms=SMS',
    subject         VARCHAR(200)    NULL COMMENT 'Asunto de la notificación',
    body            TEXT            NOT NULL COMMENT 'Cuerpo de la notificación',
    -- source event context
    source_service  VARCHAR(50)     NULL COMMENT 'Servicio de origen, ej. ms-bookings, ms-requests',
    source_entity   VARCHAR(50)     NULL COMMENT 'Entidad de origen, ej. booking, request',
    source_uuid     CHAR(36)        NULL COMMENT 'UUID de la entidad desencadenante',
    -- delivery lifecycle
    status          ENUM('queued','sending','delivered','failed','read') NOT NULL DEFAULT 'queued' COMMENT 'Estado de entrega: queued=En cola, sending=Enviando, delivered=Entregado, failed=Fallido, read=Leído',
    queued_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de encolado',
    sent_at         TIMESTAMP       NULL COMMENT 'Fecha de envío',
    delivered_at    TIMESTAMP       NULL COMMENT 'Fecha de entrega',
    read_at         TIMESTAMP       NULL COMMENT 'Fecha de lectura',
    failed_at       TIMESTAMP       NULL COMMENT 'Fecha de fallo',
    failure_reason  VARCHAR(500)    NULL COMMENT 'Motivo del fallo',
    retry_count     TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Número de reintentos realizados',
    metadata        JSON            NULL COMMENT 'Metadatos adicionales',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_notifications_uuid        (uuid),
    KEY        fk_notif_template            (template_id),
    KEY        idx_notifications_recipient  (recipient_uuid),
    KEY        idx_notifications_status     (status),
    KEY        idx_notifications_source     (source_service, source_entity, source_uuid),
    CONSTRAINT fk_notif_template
        FOREIGN KEY (template_id) REFERENCES notification_templates (id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Registros individuales de entrega de notificaciones';

-- ------------------------------------------------------------
-- user_notification_preferences
-- Preferencias de canal por usuario y por categoría de notificación
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_notification_preferences (
    id              INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid            CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    user_uuid       CHAR(36)        NOT NULL COMMENT 'Referencia a auth.users.uuid',
    category        VARCHAR(60)     NOT NULL COMMENT 'Coincide con el prefijo de notification_templates.code',
    channel         ENUM('in_app','email','push','sms') NOT NULL COMMENT 'Canal: in_app=En app, email=Correo, push=Push, sms=SMS',
    is_enabled      TINYINT(1)      NOT NULL DEFAULT 1 COMMENT 'Canal habilitado (1) o deshabilitado (0)',
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de última modificación',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_unp_uuid              (uuid),
    UNIQUE KEY uq_unp_user_cat_channel  (user_uuid, category, channel)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Preferencias de canal del usuario por categoría de notificación';

-- ------------------------------------------------------------
-- push_subscriptions
-- Suscripciones de dispositivo Web-push / FCM
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id              INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid            CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    user_uuid       CHAR(36)        NOT NULL COMMENT 'Referencia a auth.users.uuid',
    endpoint        VARCHAR(500)    NOT NULL COMMENT 'URL del endpoint de push',
    auth_key        VARCHAR(255)    NOT NULL COMMENT 'Clave VAPID auth (cifrada en reposo)',
    p256dh_key      VARCHAR(255)    NOT NULL COMMENT 'Clave VAPID p256dh (cifrada en reposo)',
    device_type     ENUM('web','android','ios') NOT NULL DEFAULT 'web' COMMENT 'Tipo de dispositivo: web=Web, android=Android, ios=iOS',
    device_label    VARCHAR(100)    NULL COMMENT 'Etiqueta amigable del dispositivo (Mi iPhone)',
    is_active       TINYINT(1)      NOT NULL DEFAULT 1 COMMENT 'Suscripción activa (1) o inactiva (0)',
    last_used_at    TIMESTAMP       NULL COMMENT 'Último uso del dispositivo',
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de última modificación',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_push_subscriptions_uuid     (uuid),
    UNIQUE KEY uq_push_subscriptions_endpoint (endpoint),
    KEY        idx_push_subscriptions_user    (user_uuid)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Suscripciones de dispositivo Web-push / FCM';

SET FOREIGN_KEY_CHECKS = 1;
