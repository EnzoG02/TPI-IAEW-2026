-- 001_init.sql : esquema inicial de Biblioteca digital (PostgreSQL 16)

CREATE TYPE estado_usuario  AS ENUM ('HABILITADO', 'BLOQUEADO');
CREATE TYPE estado_prestamo AS ENUM ('ACTIVO', 'DEVUELTO', 'VENCIDO');
CREATE TYPE estado_reserva  AS ENUM ('EN_ESPERA', 'NOTIFICADA', 'CUMPLIDA', 'CANCELADA');

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

CREATE TABLE prestamos (
  id                BIGSERIAL PRIMARY KEY,
  usuario_id        BIGINT NOT NULL REFERENCES usuarios(id),
  titulo_id         BIGINT NOT NULL REFERENCES titulos(id),
  fecha_prestamo    TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_vencimiento TIMESTAMPTZ NOT NULL,
  fecha_devolucion  TIMESTAMPTZ,
  estado            estado_prestamo NOT NULL DEFAULT 'ACTIVO'
);

-- Un usuario no puede tener dos préstamos activos del mismo título (409 PRESTAMO_DUPLICADO)
CREATE UNIQUE INDEX uq_prestamo_activo
  ON prestamos (usuario_id, titulo_id) WHERE estado = 'ACTIVO';
CREATE INDEX ix_prestamos_vencimiento ON prestamos (fecha_vencimiento) WHERE estado = 'ACTIVO';

CREATE TABLE reservas (
  id         BIGSERIAL PRIMARY KEY,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id),
  titulo_id  BIGINT NOT NULL REFERENCES titulos(id),
  estado     estado_reserva NOT NULL DEFAULT 'EN_ESPERA',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- La posición en la lista de espera se calcula por orden de created_at (FIFO), no se almacena.
CREATE UNIQUE INDEX uq_reserva_vigente
  ON reservas (usuario_id, titulo_id) WHERE estado IN ('EN_ESPERA', 'NOTIFICADA');
CREATE INDEX ix_reservas_cola ON reservas (titulo_id, created_at) WHERE estado = 'EN_ESPERA';
