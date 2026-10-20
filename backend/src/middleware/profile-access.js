import { db } from '../config/db.js';
import { HttpError } from '../utils/http-error.js';
import { audit } from '../services/audit-service.js';

/** OWNER: titular de la cuenta; REPRESENTATIVE: consulta y actualiza; VIEWER: solo consulta. */
export const AUTHORIZATION_ROLES = ['REPRESENTATIVE', 'VIEWER'];
const writeRoles = new Set(['OWNER', 'REPRESENTATIVE']);

export function canWrite(role) { return writeRoles.has(role); }

/**
 * RG-02 / RNF-03: verifica el permiso del usuario sobre un perfil concreto.
 * `write` exige titular o representante autorizado; `owner` exige la cuenta titular.
 * Los intentos sobre perfiles ajenos se rechazan y quedan auditados (CU-12).
 */
export async function assertProfileAccess(userId, profileId, { write = false, owner = false } = {}) {
  const [rows] = await db.execute(
    `SELECT p.id, p.owner_user_id, p.display_name, p.birth_date, p.relationship, p.notes, p.created_at, p.updated_at,
            CASE WHEN p.owner_user_id = ? THEN 'OWNER' ELSE a.role END AS access_role
       FROM health_profiles p
       LEFT JOIN profile_authorizations a ON a.profile_id = p.id AND a.user_id = ? AND a.status = 'ACTIVE'
      WHERE p.id = ? AND (p.owner_user_id = ? OR a.id IS NOT NULL)
      LIMIT 1`,
    [userId, userId, profileId, userId]
  );
  if (!rows.length) {
    await audit({ userId, action: 'ACCESS_DENIED', resourceType: 'HEALTH_PROFILE', resourceId: String(profileId).slice(0, 80), metadata: { reason: 'NO_AUTHORIZATION' } });
    throw new HttpError(404, 'Perfil no encontrado o sin permisos.');
  }
  const profile = rows[0];
  if ((owner && profile.access_role !== 'OWNER') || (write && !canWrite(profile.access_role))) {
    await audit({ userId, profileId: profile.id, action: 'ACCESS_DENIED', resourceType: 'HEALTH_PROFILE', resourceId: profile.id, metadata: { reason: owner ? 'OWNER_REQUIRED' : 'READ_ONLY' } });
    throw new HttpError(403, owner ? 'Solo la persona titular de la cuenta puede realizar esta acción.' : 'Tu autorización sobre este perfil es solo de consulta.');
  }
  return profile;
}
