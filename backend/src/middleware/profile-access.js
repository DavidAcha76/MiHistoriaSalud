import { db } from '../config/db.js';
import { HttpError } from '../utils/http-error.js';

export async function assertProfileAccess(userId, profileId) {
  const [rows] = await db.execute(
    `SELECT id, owner_user_id, display_name, birth_date, relationship, notes, created_at, updated_at
       FROM health_profiles WHERE id = ? AND owner_user_id = ? LIMIT 1`,
    [profileId, userId]
  );
  if (!rows.length) throw new HttpError(404, 'Perfil no encontrado o sin permisos.');
  return rows[0];
}
