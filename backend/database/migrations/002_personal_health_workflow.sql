ALTER TABLE health_events
  MODIFY event_type ENUM('ANTECEDENT','CONSULTATION','DIAGNOSIS','TREATMENT','MEDICATION','ALLERGY','VACCINE','SURGERY','LAB_RESULT','SYMPTOM','OTHER') NOT NULL;

CREATE TABLE IF NOT EXISTS symptoms (
  event_id CHAR(36) PRIMARY KEY,
  symptom_name VARCHAR(180) NOT NULL,
  body_area VARCHAR(180) NULL,
  intensity TINYINT UNSIGNED NULL,
  onset_date DATE NULL,
  resolved_date DATE NULL,
  status ENUM('ACTIVE','RESOLVED','RECURRENT','UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
  triggers_text TEXT NULL,
  relief_text TEXT NULL,
  associated_symptoms TEXT NULL,
  impact_text TEXT NULL,
  CONSTRAINT chk_symptom_intensity CHECK (intensity IS NULL OR intensity BETWEEN 0 AND 10),
  CONSTRAINT fk_symptoms_event FOREIGN KEY (event_id) REFERENCES health_events(id) ON DELETE CASCADE,
  INDEX idx_symptoms_name (symptom_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS health_event_versions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  event_id CHAR(36) NOT NULL,
  profile_id CHAR(36) NOT NULL,
  version_number INT UNSIGNED NOT NULL,
  action ENUM('CREATE','UPDATE','DELETE') NOT NULL,
  snapshot_json JSON NOT NULL,
  changed_by_user_id CHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_event_versions (event_id, version_number),
  INDEX idx_event_versions_profile_date (profile_id, created_at DESC),
  CONSTRAINT fk_event_versions_profile FOREIGN KEY (profile_id) REFERENCES health_profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_event_versions_user FOREIGN KEY (changed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE ai_analyses
  ADD COLUMN mode ENUM('MANUAL','SCHEDULED') NOT NULL DEFAULT 'MANUAL' AFTER purpose,
  ADD INDEX idx_ai_profile_mode_created (profile_id, mode, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_consents (
  profile_id CHAR(36) PRIMARY KEY,
  granted_by_user_id CHAR(36) NOT NULL,
  granted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP NULL,
  consent_version VARCHAR(40) NOT NULL,
  CONSTRAINT fk_ai_consents_profile FOREIGN KEY (profile_id) REFERENCES health_profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_ai_consents_user FOREIGN KEY (granted_by_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_subscriptions (
  user_id CHAR(36) PRIMARY KEY,
  plan_code ENUM('FREE','SILVER','GOLD') NOT NULL DEFAULT 'FREE',
  status ENUM('SIMULATED_ACTIVE','CANCELED') NOT NULL DEFAULT 'SIMULATED_ACTIVE',
  provider VARCHAR(30) NOT NULL DEFAULT 'simulation',
  activated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_subscriptions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_usage_ledger (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  profile_id CHAR(36) NOT NULL,
  plan_code ENUM('FREE','SILVER','GOLD') NOT NULL,
  usage_type ENUM('ANALYSIS','CHAT') NOT NULL,
  units INT UNSIGNED NOT NULL DEFAULT 1,
  metadata_json JSON NULL,
  occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_usage_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_usage_profile FOREIGN KEY (profile_id) REFERENCES health_profiles(id) ON DELETE CASCADE,
  INDEX idx_usage_user_type_date (user_id, usage_type, occurred_at DESC),
  INDEX idx_usage_profile_type_date (profile_id, usage_type, occurred_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_conversations (
  id CHAR(36) PRIMARY KEY,
  profile_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  title VARCHAR(180) NOT NULL DEFAULT 'Asistente para organizar mi historial',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_conversations_profile FOREIGN KEY (profile_id) REFERENCES health_profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_conversations_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_conversations_profile_date (profile_id, updated_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_messages (
  id CHAR(36) PRIMARY KEY,
  conversation_id CHAR(36) NOT NULL,
  role ENUM('USER','ASSISTANT') NOT NULL,
  content TEXT NOT NULL,
  safety_flags JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_messages_conversation FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE,
  INDEX idx_messages_conversation_date (conversation_id, created_at ASC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS in_app_notifications (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  profile_id CHAR(36) NULL,
  notification_type VARCHAR(50) NOT NULL,
  title VARCHAR(180) NOT NULL,
  body VARCHAR(1000) NOT NULL,
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_profile FOREIGN KEY (profile_id) REFERENCES health_profiles(id) ON DELETE CASCADE,
  INDEX idx_notifications_user_date (user_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS share_packages (
  id CHAR(36) PRIMARY KEY,
  profile_id CHAR(36) NOT NULL,
  created_by_user_id CHAR(36) NOT NULL,
  title VARCHAR(180) NOT NULL,
  access_token_hash CHAR(64) NOT NULL UNIQUE,
  summary_snapshot_json JSON NULL,
  events_snapshot_json JSON NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  last_accessed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_share_packages_profile FOREIGN KEY (profile_id) REFERENCES health_profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_share_packages_user FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_share_packages_profile_date (profile_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS share_package_documents (
  package_id CHAR(36) NOT NULL,
  document_id CHAR(36) NOT NULL,
  PRIMARY KEY (package_id, document_id),
  CONSTRAINT fk_share_docs_package FOREIGN KEY (package_id) REFERENCES share_packages(id) ON DELETE CASCADE,
  CONSTRAINT fk_share_docs_document FOREIGN KEY (document_id) REFERENCES clinical_documents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
