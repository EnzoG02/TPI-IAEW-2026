-- 001_init.sql : esquema inicial de Biblioteca digital (PostgreSQL 16)

CREATE TYPE estado_usuario  AS ENUM ('HABILITADO', 'BLOQUEADO');
CREATE TYPE estado_prestamo AS ENUM ('ACTIVO', 'DEVUELTO', 'VENCIDO');
CREATE TYPE estado_reserva  AS ENUM ('EN_ESPERA', 'NOTIFICADA', 'CUMPLIDA', 'CANCELADA');
CREATE TYPE tipo_aviso      AS ENUM ('PRESTAMO_CONFIRMADO', 'RECORDATORIO_DEVOLUCION', 'VENCIMIENTO', 'CUPO_DISPONIBLE');
CREATE TYPE estado_multa    AS ENUM ('PENDIENTE', 'PAGADA');

CREATE TABLE usuarios (
  id         BIGSERIAL PRIMARY KEY,
  nombre     VARCHAR(120) NOT NULL,
  email      VARCHAR(160) NOT NULL UNIQUE,
  estado     estado_usuario NOT NULL DEFAULT 'HABILITADO',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE titulos (
  id              BIGSERIAL PRIMARY KEY,
  titulo          VARCHAR(200) NOT NULL,
  autor           VARCHAR(160) NOT NULL,
  isbn            VARCHAR(20) UNIQUE,
  cupo_total      INTEGER NOT NULL CHECK (cupo_total > 0),
  cupo_disponible INTEGER NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_cupo CHECK (cupo_disponible >= 0 AND cupo_disponible <= cupo_total)
);

-- Las FK no tienen ON DELETE: un usuario o título con historial (préstamos, reservas, avisos)
-- no se puede borrar. La API responde 409 USUARIO_CON_HISTORIAL / TITULO_CON_HISTORIAL.
CREATE TABLE prestamos (
  id                BIGSERIAL PRIMARY KEY,
  usuario_id        BIGINT NOT NULL REFERENCES usuarios(id),
  titulo_id         BIGINT NOT NULL REFERENCES titulos(id),
  fecha_prestamo    TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_vencimiento TIMESTAMPTZ NOT NULL,
  fecha_devolucion  TIMESTAMPTZ,
  estado            estado_prestamo NOT NULL DEFAULT 'ACTIVO',
  CONSTRAINT ck_vencimiento CHECK (fecha_vencimiento > fecha_prestamo),
  CONSTRAINT ck_devolucion  CHECK ((estado = 'DEVUELTO') = (fecha_devolucion IS NOT NULL))
);

-- Un usuario no puede tener dos préstamos sin devolver del mismo título (409 PRESTAMO_DUPLICADO).
-- VENCIDO también cuenta: el e-book sigue en poder del usuario.
CREATE UNIQUE INDEX uq_prestamo_activo
  ON prestamos (usuario_id, titulo_id) WHERE estado IN ('ACTIVO', 'VENCIDO');
CREATE INDEX ix_prestamos_vencimiento ON prestamos (fecha_vencimiento) WHERE estado = 'ACTIVO';

CREATE TABLE reservas (
  id            BIGSERIAL PRIMARY KEY,
  usuario_id    BIGINT NOT NULL REFERENCES usuarios(id),
  titulo_id     BIGINT NOT NULL REFERENCES titulos(id),
  estado        estado_reserva NOT NULL DEFAULT 'EN_ESPERA',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  notificada_at TIMESTAMPTZ   -- momento en que se le avisó que tiene un cupo reservado
);

-- La posición en la lista de espera se calcula por orden de created_at (FIFO), no se almacena.
CREATE UNIQUE INDEX uq_reserva_vigente
  ON reservas (usuario_id, titulo_id) WHERE estado IN ('EN_ESPERA', 'NOTIFICADA');
CREATE INDEX ix_reservas_cola ON reservas (titulo_id, created_at) WHERE estado = 'EN_ESPERA';

-- Registros generados por el worker (consumidor de prestamo.creado y job de vencimientos).
CREATE TABLE avisos (
  id          BIGSERIAL PRIMARY KEY,
  usuario_id  BIGINT NOT NULL REFERENCES usuarios(id),
  prestamo_id BIGINT REFERENCES prestamos(id),
  reserva_id  BIGINT REFERENCES reservas(id),
  tipo        tipo_aviso NOT NULL,
  canal       VARCHAR(20) NOT NULL CHECK (canal IN ('LOG', 'WEBSOCKET')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_aviso_origen CHECK (prestamo_id IS NOT NULL OR reserva_id IS NOT NULL)
);

-- Idempotencia del consumidor: si RabbitMQ re-entrega un evento, el INSERT ... ON CONFLICT DO NOTHING
-- no duplica el aviso.
CREATE UNIQUE INDEX uq_aviso_prestamo ON avisos (prestamo_id, tipo) WHERE prestamo_id IS NOT NULL;
CREATE UNIQUE INDEX uq_aviso_reserva  ON avisos (reserva_id, tipo)  WHERE reserva_id  IS NOT NULL;

CREATE TABLE multas (
  id          BIGSERIAL PRIMARY KEY,
  prestamo_id BIGINT NOT NULL UNIQUE REFERENCES prestamos(id),   -- una multa por préstamo vencido
  usuario_id  BIGINT NOT NULL REFERENCES usuarios(id),
  monto       NUMERIC(10, 2) NOT NULL CHECK (monto > 0),
  estado      estado_multa NOT NULL DEFAULT 'PENDIENTE',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
