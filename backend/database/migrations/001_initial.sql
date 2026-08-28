CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS health_profiles (
  id CHAR(36) PRIMARY KEY,
  owner_user_id CHAR(36) NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  birth_date DATE NULL,
  relationship ENUM('SELF','CHILD','PARENT','OTHER') NOT NULL DEFAULT 'SELF',
  notes VARCHAR(1000) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_profiles_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_profiles_owner (owner_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS health_events (
  id CHAR(36) PRIMARY KEY,
  profile_id CHAR(36) NOT NULL,
  event_type ENUM('ANTECEDENT','CONSULTATION','DIAGNOSIS','TREATMENT','MEDICATION','ALLERGY','VACCINE','SURGERY','LAB_RESULT','OTHER') NOT NULL,
  title VARCHAR(180) NOT NULL,
  description TEXT NULL,
  event_date DATE NOT NULL,
  source VARCHAR(255) NULL,
  notes TEXT NULL,
  created_by_user_id CHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_events_profile FOREIGN KEY (profile_id) REFERENCES health_profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_events_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_events_profile_date (profile_id, event_date DESC),
  INDEX idx_events_profile_type (profile_id, event_type),
  FULLTEXT INDEX ftx_events_search (title, description, source)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS antecedents (
  event_id CHAR(36) PRIMARY KEY,
  category ENUM('PERSONAL','FAMILY','OTHER') NULL,
  condition_name VARCHAR(180) NULL,
  relationship_person VARCHAR(120) NULL,
  onset_date DATE NULL,
  status VARCHAR(80) NULL,
  CONSTRAINT fk_antecedents_event FOREIGN KEY (event_id) REFERENCES health_events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS consultations (
  event_id CHAR(36) PRIMARY KEY,
  professional_name VARCHAR(160) NULL,
  specialty VARCHAR(120) NULL,
  facility VARCHAR(180) NULL,
  reason VARCHAR(1000) NULL,
  CONSTRAINT fk_consultations_event FOREIGN KEY (event_id) REFERENCES health_events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS diagnoses (
  event_id CHAR(36) PRIMARY KEY,
  diagnosis_name VARCHAR(180) NULL,
  status VARCHAR(80) NULL,
  diagnosed_by VARCHAR(160) NULL,
  CONSTRAINT fk_diagnoses_event FOREIGN KEY (event_id) REFERENCES health_events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS treatments (
  event_id CHAR(36) PRIMARY KEY,
  treatment_name VARCHAR(180) NULL,
  instructions TEXT NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  CONSTRAINT fk_treatments_event FOREIGN KEY (event_id) REFERENCES health_events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medications (
  event_id CHAR(36) PRIMARY KEY,
  medication_name VARCHAR(180) NULL,
  dose VARCHAR(120) NULL,
  frequency VARCHAR(120) NULL,
  route VARCHAR(120) NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  status VARCHAR(80) NULL,
  CONSTRAINT fk_medications_event FOREIGN KEY (event_id) REFERENCES health_events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS allergies (
  event_id CHAR(36) PRIMARY KEY,
  allergen VARCHAR(180) NULL,
  reaction VARCHAR(500) NULL,
  severity VARCHAR(80) NULL,
  status VARCHAR(80) NULL,
  CONSTRAINT fk_allergies_event FOREIGN KEY (event_id) REFERENCES health_events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vaccinations (
  event_id CHAR(36) PRIMARY KEY,
  vaccine_name VARCHAR(180) NULL,
  dose_number VARCHAR(80) NULL,
  lot_number VARCHAR(100) NULL,
  provider VARCHAR(180) NULL,
  CONSTRAINT fk_vaccinations_event FOREIGN KEY (event_id) REFERENCES health_events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS surgeries (
  event_id CHAR(36) PRIMARY KEY,
  procedure_name VARCHAR(180) NULL,
  facility VARCHAR(180) NULL,
  professional_name VARCHAR(160) NULL,
  CONSTRAINT fk_surgeries_event FOREIGN KEY (event_id) REFERENCES health_events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lab_results (
  event_id CHAR(36) PRIMARY KEY,
  test_name VARCHAR(180) NULL,
  value_text VARCHAR(500) NULL,
  value_numeric DECIMAL(18,6) NULL,
  unit VARCHAR(80) NULL,
  reference_range VARCHAR(180) NULL,
  flag VARCHAR(80) NULL,
  laboratory VARCHAR(180) NULL,
  CONSTRAINT fk_labs_event FOREIGN KEY (event_id) REFERENCES health_events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS clinical_documents (
  id CHAR(36) PRIMARY KEY,
  profile_id CHAR(36) NOT NULL,
  event_id CHAR(36) NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  size_bytes BIGINT UNSIGNED NOT NULL,
  storage_driver VARCHAR(20) NOT NULL,
  storage_key VARCHAR(600) NOT NULL,
  uploaded_by_user_id CHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_documents_profile FOREIGN KEY (profile_id) REFERENCES health_profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_documents_event FOREIGN KEY (event_id) REFERENCES health_events(id) ON DELETE SET NULL,
  CONSTRAINT fk_documents_user FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_documents_profile (profile_id, created_at DESC),
  INDEX idx_documents_event (event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_analyses (
  id CHAR(36) PRIMARY KEY,
  profile_id CHAR(36) NOT NULL,
  requested_by_user_id CHAR(36) NOT NULL,
  purpose VARCHAR(300) NOT NULL,
  selected_event_ids JSON NOT NULL,
  input_snapshot_hash CHAR(64) NOT NULL,
  provider VARCHAR(80) NOT NULL,
  model VARCHAR(120) NOT NULL,
  status ENUM('PROCESSING','COMPLETED','REJECTED') NOT NULL DEFAULT 'PROCESSING',
  output_json JSON NULL,
  safety_flags JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ai_profile FOREIGN KEY (profile_id) REFERENCES health_profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_ai_user FOREIGN KEY (requested_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_ai_profile_created (profile_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  device_info VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_refresh_user (user_id),
  INDEX idx_refresh_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(36) NULL,
  profile_id CHAR(36) NULL,
  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(80) NOT NULL,
  resource_id VARCHAR(80) NULL,
  metadata_json JSON NULL,
  ip_address VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_audit_profile FOREIGN KEY (profile_id) REFERENCES health_profiles(id) ON DELETE SET NULL,
  INDEX idx_audit_profile_date (profile_id, created_at DESC),
  INDEX idx_audit_user_date (user_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
