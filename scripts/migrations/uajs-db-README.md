# UAJS Smart Campus — Microservices Database Architecture

**Author:** Darwin Montes  
**Version:** 1.0.0  
**Engine:** MySQL 8.0+  
**Charset:** `utf8mb4` / `utf8mb4_unicode_ci`

---

## Design Principles

| Principle                    | Implementation                                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Database-per-service**     | Each microservice owns its schema. No shared tables, no cross-DB foreign keys.                                            |
| **Cross-service references** | Stored as `uuid` + denormalized snapshot fields (name, label). Synced via domain events (BullMQ).                         |
| **Soft deletes**             | All primary entities include `deleted_at TIMESTAMP NULL`. Hard deletes only in audit/log tables.                          |
| **Idempotent migrations**    | All `CREATE TABLE IF NOT EXISTS`. Safe to replay.                                                                         |
| **Immutable audit trails**   | Every state-machine entity has a companion `*_audit_trail` table. No UPDATE/DELETE on audit rows.                         |
| **Naming**                   | Tables → `snake_case` plural English nouns. PKs → `id`. UUIDs → `uuid` (exposed externally). FKs → `<table_singular>_id`. |
| **Timezone**                 | All timestamps in UTC (`SET time_zone = '+00:00'`). Conversion to `America/Bogota` at application layer.                  |

---

## Database Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                    UAJS SMART CAMPUS DATABASES                      │
├──────────────────┬──────────────────────────────────────────────────┤
│  Database        │  Owned by       │  Tables                        │
├──────────────────┼─────────────────┼────────────────────────────────┤
│  uajs_catalog    │  ms-catalog     │  countries, departments, cities,     │
│                  │                 │  document_types                 │
├──────────────────┼─────────────────┼────────────────────────────────┤
│  uajs_auth       │  ms-auth        │  persons (snapshot), users,     │
│                  │                 │  roles, permissions,            │
│                  │                 │  role_permissions,              │
│                  │                 │  user_roles, user_permissions,  │
│                  │                 │  refresh_tokens,                │
│                  │                 │  password_reset_tokens,         │
│                  │                 │  email_verification_tokens,     │
│                  │                 │  audit_logs                     │
├──────────────────┼─────────────────┼────────────────────────────────┤
│  uajs_academic   │  ms-academic    │  campuses, companies, persons,  │
│                  │                 │  faculties, programs,           │
│                  │                 │  students, teachers             │
├──────────────────┼─────────────────┼────────────────────────────────┤
│  uajs_resources  │  ms-resources   │  resource_categories,           │
│                  │                 │  resource_statuses, resources,  │
│                  │                 │  resource_schedules,            │
│                  │                 │  resource_blackouts,            │
│                  │                 │  inventory_items                │
├──────────────────┼─────────────────┼────────────────────────────────┤
│  uajs_bookings   │  ms-bookings    │  booking_types,                 │
│                  │                 │  booking_statuses, bookings,    │
│                  │                 │  booking_audit_trail            │
├──────────────────┼─────────────────┼────────────────────────────────┤
│  uajs_requests   │  ms-requests    │  request_categories,            │
│                  │                 │  request_types,                 │
│                  │                 │  request_statuses, requests,    │
│                  │                 │  request_comments,              │
│                  │                 │  request_attachments,           │
│                  │                 │  request_audit_trail            │
├──────────────────┼─────────────────┼────────────────────────────────┤
│  uajs_events     │  ms-events      │  event_categories,              │
│                  │                 │  event_statuses, events,        │
│                  │                 │  event_registrations            │
├──────────────────┼─────────────────┼────────────────────────────────┤
│  uajs_notif.     │  ms-notif.      │  notification_templates,        │
│                  │                 │  notifications,                 │
│                  │                 │  user_notification_preferences, │
│                  │                 │  push_subscriptions             │
└──────────────────┴─────────────────┴────────────────────────────────┘
```

---

## Cross-Service Data Flow

```
ms-catalog ──────► ms-academic ──────► ms-auth
  (cities,           (campuses,          (users,
  doc. types)        persons, students)   roles, tokens)
                          │                    │
                          ▼                    ▼
                    ms-resources        ms-notifications
                    (bookable assets)   (delivery engine)
                          │
                          ▼
                    ms-bookings ────────────────────┐
                                                    │
                    ms-requests ────────────────────┤
                                                    │
                    ms-events ──────────────────────┘
                          │
                          ▼
                    ms-notifications
                    (all services emit events → BullMQ → ms-notifications)
```

**Rule:** Services communicate cross-boundary only via:

1. **REST API calls** (synchronous read of another service's data)
2. **Domain events** (asynchronous, published to BullMQ)
3. **UUID references** stored as `CHAR(36)` + a denormalized snapshot column

---

## State Machines

### Booking lifecycle

```
pending ──► approved ──► confirmed ──► completed
   │                          │
   └──► rejected              └──► cancelled
                              └──► no_show
```

### Request lifecycle

```
pending ──► in_review ──► approved ──► closed
   │              │
   └──────────────└──► rejected ──► closed
```

### Event lifecycle

```
draft ──► published ──► ongoing ──► completed
                │
                └──► cancelled
```

---

## Deployment

### Apply all schemas (Docker Compose)

```bash
for db in ms-catalog ms-auth ms-academic ms-resources ms-bookings ms-requests ms-events ms-notifications; do
  mysql -h 127.0.0.1 -P 3306 -u root -p < ./${db}/001_init.sql
  echo "✓ ${db} applied"
done
```

### Individual Kubernetes init-container pattern

Each service's Helm chart mounts its own `001_init.sql` as a ConfigMap and runs it as an init-container before the service pod starts.

---

## Naming Convention Quick Reference

| Object            | Convention            | Example               |
| ----------------- | --------------------- | --------------------- |
| Table             | `snake_case` plural   | `booking_audit_trail` |
| Primary key       | `id` (INT UNSIGNED)   | `id`                  |
| External UUID ref | `<entity>_uuid`       | `requester_uuid`      |
| Snapshot column   | `<entity>_<field>`    | `requester_name`      |
| FK column         | `<table_singular>_id` | `status_id`           |
| Boolean           | `is_<adjective>`      | `is_active`           |
| Timestamp         | `<event>_at`          | `cancelled_at`        |
| Unique constraint | `uq_<table>_<cols>`   | `uq_bookings_slot`    |
| FK constraint     | `fk_<abbr>_<target>`  | `fk_bat_booking`      |
| Index             | `idx_<table>_<cols>`  | `idx_events_dates`    |
| Check constraint  | `chk_<table>_<desc>`  | `chk_bookings_time`   |
