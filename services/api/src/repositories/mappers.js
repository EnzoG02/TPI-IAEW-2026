// Conversión de filas de PostgreSQL (snake_case) a los schemas del contrato (camelCase).
const num = (value) => (value === null || value === undefined ? value : Number(value));

const titulo = (r) => ({
  id: num(r.id), titulo: r.titulo, autor: r.autor, isbn: r.isbn,
  cupoTotal: r.cupo_total, cupoDisponible: r.cupo_disponible, createdAt: r.created_at,
});

const usuario = (r) => ({
  id: num(r.id), nombre: r.nombre, email: r.email, estado: r.estado, createdAt: r.created_at,
});

const prestamo = (r) => ({
  id: num(r.id), usuarioId: num(r.usuario_id), tituloId: num(r.titulo_id),
  fechaPrestamo: r.fecha_prestamo, fechaVencimiento: r.fecha_vencimiento,
  fechaDevolucion: r.fecha_devolucion, estado: r.estado,
});

const reserva = (r) => ({
  id: num(r.id), usuarioId: num(r.usuario_id), tituloId: num(r.titulo_id), estado: r.estado,
  posicion: r.posicion === null || r.posicion === undefined ? null : Number(r.posicion),
  createdAt: r.created_at, notificadaAt: r.notificada_at,
});

const aviso = (r) => ({
  id: num(r.id), usuarioId: num(r.usuario_id), prestamoId: num(r.prestamo_id), reservaId: num(r.reserva_id),
  tipo: r.tipo, canal: r.canal, createdAt: r.created_at,
});

function page(rows, mapper, { page: pageNumber, pageSize }) {
  const total = rows.length ? Number(rows[0].total) : 0;
  return { data: rows.map(mapper), page: pageNumber, pageSize, total };
}

module.exports = { titulo, usuario, prestamo, reserva, aviso, page };
