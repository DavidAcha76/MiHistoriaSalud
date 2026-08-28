import { db } from '../config/db.js';

export async function audit({ userId, profileId = null, action, resourceType, resourceId = null, metadata = null, ip = null }) {
  try {
    await db.execute(
      `INSERT INTO audit_logs (user_id, profile_id, action, resource_type, resource_id, metadata_json, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, profileId, action, resourceType, resourceId, metadata ? JSON.stringify(metadata) : null, ip]
    );
  } catch (error) {
    console.error('No se pudo registrar auditoría:', error.message);
  }
}
