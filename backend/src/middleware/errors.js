import { ZodError } from 'zod';
import { HttpError } from '../utils/http-error.js';

export function notFound(req, _res, next) {
  next(new HttpError(404, `Ruta no encontrada: ${req.method} ${req.originalUrl}`));
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Datos inválidos.',
      details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
    });
  }
  if (err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'El archivo excede el tamaño permitido.' });
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, details: err.details });
  console.error(err);
  return res.status(500).json({ error: 'Error interno del servidor.' });
}
