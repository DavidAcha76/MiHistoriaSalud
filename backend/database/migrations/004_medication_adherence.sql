CREATE TABLE IF NOT EXISTS medication_regimens (
  id CHAR(36) PRIMARY KEY,
  profile_id CHAR(36) NOT NULL,
  created_by_user_id CHAR(36) NOT NULL,
  medication_name VARCHAR(180) NOT NULL,
  dose VARCHAR(120) NULL,
  schedule_days JSON NOT NULL,
  schedule_times JSON NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  notes TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_medication_regimens_profile FOREIGN KEY (profile_id) REFERENCES health_profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_medication_regimens_user FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_medication_regimens_profile_active (profile_id, is_active, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medication_doses (
  id CHAR(36) PRIMARY KEY,
  regimen_id CHAR(36) NOT NULL,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  status ENUM('PENDING','CONFIRMED') NOT NULL DEFAULT 'PENDING',
  confirmed_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_medication_dose_schedule (regimen_id, scheduled_date, scheduled_time),
  CONSTRAINT fk_medication_doses_regimen FOREIGN KEY (regimen_id) REFERENCES medication_regimens(id) ON DELETE CASCADE,
  INDEX idx_medication_doses_regimen_date (regimen_id, scheduled_date DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medication_regimen_pauses (
  id CHAR(36) PRIMARY KEY,
  regimen_id CHAR(36) NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_medication_pauses_regimen FOREIGN KEY (regimen_id) REFERENCES medication_regimens(id) ON DELETE CASCADE,
  INDEX idx_medication_pauses_regimen_dates (regimen_id, starts_on, ends_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
