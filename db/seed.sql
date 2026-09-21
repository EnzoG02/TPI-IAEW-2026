-- seed.sql : datos de demo (cubre los 4 errores del dominio)

INSERT INTO usuarios (nombre, email, estado) VALUES
  ('Ana Pérez',   'ana@example.com',   'HABILITADO'),
  ('Bruno Gómez', 'bruno@example.com', 'HABILITADO'),
  ('Carla Ruiz',  'carla@example.com', 'BLOQUEADO');   -- para probar 403 USUARIO_BLOQUEADO

INSERT INTO titulos (titulo, autor, isbn, cupo_total, cupo_disponible) VALUES
  ('Cien años de soledad', 'Gabriel García Márquez', '978-0307474728', 3, 3),
  ('Rayuela',              'Julio Cortázar',         '978-8437604572', 2, 2),
  ('El Aleph',             'Jorge Luis Borges',      '978-0142437889', 1, 0),  -- cupo agotado (409)
  ('Ficciones',            'Jorge Luis Borges',      '978-0802130303', 2, 2);

-- Préstamo activo de Ana sobre "El Aleph" (cupo en 0 y permite probar 409 duplicado)
INSERT INTO prestamos (usuario_id, titulo_id, fecha_vencimiento) VALUES
  (1, 3, now() + interval '14 days');
