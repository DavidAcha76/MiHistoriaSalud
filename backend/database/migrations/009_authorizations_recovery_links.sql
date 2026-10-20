-- RF-07 / RG-02: relaciones explícitas de autorización entre cuentas y perfiles.
-- Una sola relación por usuario y perfil; el rol y el estado se actualizan en su lugar.
CREATE TABLE IF NOT EXISTS profile_authorizations (
  id CHAR(36) PRIMARY KEY,
  profile_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  role ENUM('REPRESENTATIVE','VIEWER') NOT NULL,
  status ENUM('ACTIVE','REVOKED') NOT NULL DEFAULT 'ACTIVE',
  granted_by_user_id CHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  revoked_at DATETIME NULL,
  UNIQUE KEY uq_profile_authorization (profile_id, user_id),
  INDEX idx_authorizations_user_status (user_id, status),
  CONSTRAINT fk_authorizations_profile FOREIGN KEY (profile_id) REFERENCES health_profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_authorizations_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_authorizations_granter FOREIGN KEY (granted_by_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- RF-03: recuperación de acceso con tokens de un solo uso; solo se guarda su hash.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_password_reset_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- RF-18: vínculos entre registros del mismo perfil (p. ej., un resultado con su consulta).
-- El par se guarda ordenado (event_id < linked_event_id) para que cada vínculo sea único.
CREATE TABLE IF NOT EXISTS health_event_links (
  event_id CHAR(36) NOT NULL,
  linked_event_id CHAR(36) NOT NULL,
  profile_id CHAR(36) NOT NULL,
  created_by_user_id CHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (event_id, linked_event_id),
  INDEX idx_event_links_linked (linked_event_id),
  CONSTRAINT fk_event_links_event FOREIGN KEY (event_id) REFERENCES health_events(id) ON DELETE CASCADE,
  CONSTRAINT fk_event_links_linked FOREIGN KEY (linked_event_id) REFERENCES health_events(id) ON DELETE CASCADE,
  CONSTRAINT fk_event_links_profile FOREIGN KEY (profile_id) REFERENCES health_profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_event_links_user FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Diccionario de datos: integridad del documento por hash SHA-256 del contenido.
ALTER TABLE clinical_documents
  ADD COLUMN content_sha256 CHAR(64) NULL AFTER size_bytes;

-- RF-27 / RF-28: finalidad explícita de cada análisis (resumen, revisión de consistencia o ambas).
ALTER TABLE ai_analyses
  ADD COLUMN review_focus ENUM('SUMMARY','CONSISTENCY','COMPLETE') NULL AFTER mode;

-- RF-30: consultas de trazabilidad por perfil y tipo de acción.
ALTER TABLE audit_logs
  ADD INDEX idx_audit_profile_action_date (profile_id, action, created_at);
