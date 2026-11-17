-- ============================================================
-- SEEDER: uajs_notifications — Plantillas Base de Notificaciones
-- Microservicio: ms-notifications / notification-service
-- Descripción: Plantillas transaccionales para correo y canales in-app
-- ============================================================

CREATE DATABASE IF NOT EXISTS uajs_notifications
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE uajs_notifications;

SET FOREIGN_KEY_CHECKS = 0;
SET time_zone = '+00:00';

-- ------------------------------------------------------------
-- notification_templates
-- ------------------------------------------------------------
INSERT INTO notification_templates (
    id, uuid, code, name, channel, subject, body_text, body_html, variables, is_active
)
VALUES
    (1, 'nt000000-0000-0000-0000-000000000001', 'auth.welcome', 'Bienvenida a Smart Campus UAJS', 'email',
     '¡Bienvenido a UAJS Smart Campus, {{nombre}}!',
     'Hola {{nombre}}, tu cuenta institucional ha sido activada con éxito. Tu rol asignado es {{rol}}. Inicia sesión en https://campus.uajs.edu',
     '<h2>Bienvenido a UAJS Smart Campus</h2><p>Hola <strong>{{nombre}}</strong>,</p><p>Tu cuenta con correo <em>{{email}}</em> está lista.</p>',
     '["nombre", "email", "rol"]', 1),

    (2, 'nt000000-0000-0000-0000-000000000002', 'auth.password_reset', 'Recuperación de Contraseña', 'email',
     'Restablecimiento de contraseña para tu cuenta UAJS',
     'Hola {{nombre}}, has solicitado restablecer tu contraseña. Tu código de verificación es: {{codigo}}. Expira en 15 minutos.',
     '<h2>Restablecimiento de Contraseña</h2><p>Código temporal: <strong style="font-size:20px;">{{codigo}}</strong></p>',
     '["nombre", "codigo"]', 1),

    (3, 'nt000000-0000-0000-0000-000000000003', 'booking.confirmed', 'Confirmación de Reserva de Espacio', 'email',
     'Reserva Confirmada: {{recurso}} para el {{fecha}}',
     'Hola {{nombre}}, tu reserva del recurso {{recurso}} ha sido confirmada para la fecha {{fecha}} entre {{hora_inicio}} y {{hora_fin}}.',
     '<h2>Reserva Confirmada</h2><p>Espacio: <strong>{{recurso}}</strong></p><p>Fecha: {{fecha}}</p>',
     '["nombre", "recurso", "fecha", "hora_inicio", "hora_fin"]', 1),

    (4, 'nt000000-0000-0000-0000-000000000004', 'request.status_changed', 'Actualización de Estado de Trámite', 'in_app',
     'Tu solicitud {{codigo_tramite}} cambió de estado',
     'Tu trámite de {{tipo_tramite}} ahora se encuentra en estado: {{nuevo_estado}}.',
     NULL,
     '["codigo_tramite", "tipo_tramite", "nuevo_estado"]', 1)
ON DUPLICATE KEY UPDATE
    name       = VALUES(name),
    subject    = VALUES(subject),
    body_text  = VALUES(body_text),
    body_html  = VALUES(body_html),
    variables  = VALUES(variables),
    is_active  = VALUES(is_active);

SET FOREIGN_KEY_CHECKS = 1;
