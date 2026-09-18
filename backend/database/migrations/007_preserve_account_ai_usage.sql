-- Deleting a dependent profile must not restore the account's weekly quota.
-- Retain usage units while removing the association with the deleted profile.
ALTER TABLE ai_usage_ledger
  DROP FOREIGN KEY fk_usage_profile;
ALTER TABLE ai_usage_ledger
  MODIFY profile_id CHAR(36) NULL,
  ADD CONSTRAINT fk_usage_profile FOREIGN KEY (profile_id)
    REFERENCES health_profiles(id) ON DELETE SET NULL;
