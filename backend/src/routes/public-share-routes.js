import express from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/async-handler.js';
import { resolvePublicShare, resolveSharedDocument } from '../services/share-service.js';
import { openPrivateFile } from '../services/storage-service.js';

export const publicShareRouter = express.Router();

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

function renderList(title, values) {
  if (!values?.length) return '';
  return `<section><h2>${escapeHtml(title)}</h2><ul>${values.map((value) => `<li>${escapeHtml(value)}</li>`).join('')}</ul></section>`;
}

publicShareRouter.get('/share/:token', asyncHandler(async (req, res) => {
  const token = z.string().min(30).max(200).parse(req.params.token);
  const share = await resolvePublicShare(token);
  const eventRows = share.events.map((event) => `<li><strong>${escapeHtml(event.event_date || event.eventDate)} · ${escapeHtml(event.title)}</strong><br><small>${escapeHtml(event.event_type || event.eventType)}</small>${event.description ? `<p>${escapeHtml(event.description)}</p>` : ''}</li>`).join('');
  const documents = share.documents.map((document) => `<li><a href="/share/${encodeURIComponent(token)}/documents/${encodeURIComponent(document.id)}/download">${escapeHtml(document.originalName)}</a> <small>${escapeHtml(document.mimeType)}</small></li>`).join('');
  const summary = share.summary;
  const sections = summary ? [
    renderList('Alergias', summary.allergies?.map((item) => `${item.allergen || item.title}${item.reaction ? ` — ${item.reaction}` : ''}`)),
    renderList('Medicamentos', summary.medications?.map((item) => `${item.medicationName || item.title}${item.dose ? ` · ${item.dose}` : ''}`)),
    renderList('Diagnósticos declarados', summary.diagnoses?.map((item) => item.diagnosisName || item.title))
  ].join('') : '';
  res.setHeader('Cache-Control', 'private, no-store');
  res.type('html').send(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(share.title)}</title><style>body{font-family:system-ui,sans-serif;max-width:850px;margin:32px auto;padding:0 18px;color:#132A35}section{border:1px solid #d7e2e7;border-radius:12px;padding:16px;margin:16px 0}h1{margin-bottom:4px}small{color:#536873}li{margin:9px 0}a{color:#146c94}</style></head><body><h1>${escapeHtml(share.title)}</h1><p>Perfil: ${escapeHtml(share.profileName)} · Disponible hasta ${escapeHtml(new Date(share.expiresAt).toLocaleString('es'))}</p><p>Información compartida voluntariamente por la persona titular. No sustituye una historia clínica institucional.</p>${sections}${eventRows ? `<section><h2>Registros seleccionados</h2><ul>${eventRows}</ul></section>` : ''}${documents ? `<section><h2>Documentos seleccionados</h2><ul>${documents}</ul></section>` : ''}</body></html>`);
}));

publicShareRouter.get('/share/:token/documents/:documentId/download', asyncHandler(async (req, res) => {
  const token = z.string().min(30).max(200).parse(req.params.token);
  const documentId = z.string().uuid().parse(req.params.documentId);
  const { document } = await resolveSharedDocument(token, documentId);
  const { stream } = await openPrivateFile(document.storage_driver, document.storage_key);
  res.setHeader('Content-Type', document.mime_type);
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(document.original_name)}`);
  res.setHeader('Cache-Control', 'private, no-store');
  stream.on('error', (error) => res.destroy(error));
  stream.pipe(res);
}));
