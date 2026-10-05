-- seed.sql : datos de demo (cubre los errores del dominio y la lista de espera)

INSERT INTO usuarios (nombre, email, estado) VALUES
  ('Ana Pérez',   'ana@example.com',   'HABILITADO'),
  ('Bruno Gómez', 'bruno@example.com', 'HABILITADO'),
  ('Carla Ruiz',  'carla@example.com', 'BLOQUEADO'),    -- para probar 403 USUARIO_BLOQUEADO
  ('Diego Sosa',  'diego@example.com', 'HABILITADO');   -- préstamo vencido: 403 PRESTAMOS_VENCIDOS

INSERT INTO titulos (titulo, autor, isbn, cupo_total, cupo_disponible) VALUES
  ('Cien años de soledad', 'Gabriel García Márquez', '978-0307474728', 3, 3),
  ('Rayuela',              'Julio Cortázar',         '978-8437604572', 2, 1),  -- un ejemplar lo tiene Diego
  ('El Aleph',             'Jorge Luis Borges',      '978-0142437889', 1, 0),  -- cupo agotado (409)
  ('Ficciones',            'Jorge Luis Borges',      '978-0802130303', 2, 2);

-- Préstamo activo de Ana sobre "El Aleph" (cupo en 0 y permite probar 409 duplicado)
INSERT INTO prestamos (usuario_id, titulo_id, fecha_vencimiento) VALUES
  (1, 3, now() + interval '14 days');

-- Préstamo vencido y sin devolver de Diego sobre "Rayuela"
INSERT INTO prestamos (usuario_id, titulo_id, fecha_prestamo, fecha_vencimiento, estado) VALUES
  (4, 2, now() - interval '30 days', now() - interval '16 days', 'VENCIDO');

-- Bruno espera "El Aleph": cuando Ana lo devuelva, Bruno recibe el aviso por WebSocket
INSERT INTO reservas (usuario_id, titulo_id) VALUES
  (2, 3);
