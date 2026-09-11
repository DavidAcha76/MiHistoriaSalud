import { db } from '../config/db.js';
import { HttpError } from '../utils/http-error.js';
import { randomId, randomToken, sha256 } from '../utils/security.js';

const parseJson = (value) => typeof value === 'string' ? JSON.parse(value) : value;

export async function createSharePackage({ profileId, userId, title, events, documents, summary, expiresAt }) {
  const id = randomId();
  const token = randomToken();
  await db.execute(
    `INSERT INTO share_packages (id, profile_id, created_by_user_id, title, access_token_hash, summary_snapshot_json, events_snapshot_json, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, profileId, userId, title, sha256(token), summary ? JSON.stringify(summary) : null, JSON.stringify(events), expiresAt]
  );
  for (const document of documents) {
    await db.execute('INSERT INTO share_package_documents (package_id, document_id) VALUES (?, ?)', [id, document.id]);
  }
  return { id, token };
}

export async function resolvePublicShare(token) {
  const [rows] = await db.execute(
    `SELECT p.*, h.display_name AS profile_name
       FROM share_packages p
       JOIN health_profiles h ON h.id=p.profile_id
      WHERE p.access_token_hash=? AND p.revoked_at IS NULL AND p.expires_at > NOW()
      LIMIT 1`,
    [sha256(token)]
  );
  if (!rows.length) throw new HttpError(404, 'El enlace no existe, venció o fue revocado.');
  const packageRow = rows[0];
  await db.execute('UPDATE share_packages SET last_accessed_at=NOW() WHERE id=?', [packageRow.id]);
  const [documents] = await db.execute(
    `SELECT d.id, d.original_name AS originalName, d.mime_type AS mimeType, d.size_bytes AS sizeBytes
       FROM share_package_documents sd
       JOIN clinical_documents d ON d.id=sd.document_id
      WHERE sd.package_id=? ORDER BY d.created_at ASC`,
    [packageRow.id]
  );
  return {
    id: packageRow.id,
    profileName: packageRow.profile_name,
    title: packageRow.title,
    summary: packageRow.summary_snapshot_json ? parseJson(packageRow.summary_snapshot_json) : null,
    events: parseJson(packageRow.events_snapshot_json) || [],
    documents,
    expiresAt: packageRow.expires_at,
    createdByUserId: packageRow.created_by_user_id
  };
}

export async function resolveSharedDocument(token, documentId) {
  const share = await resolvePublicShare(token);
  const document = share.documents.find((item) => item.id === documentId);
  if (!document) throw new HttpError(404, 'Documento no incluido en este paquete.');
  const [rows] = await db.execute('SELECT * FROM clinical_documents WHERE id=? LIMIT 1', [documentId]);
  if (!rows.length) throw new HttpError(404, 'Documento no disponible.');
  return { share, document: rows[0] };
}
