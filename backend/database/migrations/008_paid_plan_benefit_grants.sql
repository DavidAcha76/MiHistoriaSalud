-- A paid upgrade starts a distinct allowance without deleting past usage.
-- Existing subscriptions keep NULL and retain their current consumption.
ALTER TABLE user_subscriptions
  ADD COLUMN ai_benefit_grant_id CHAR(36) NULL;

ALTER TABLE ai_usage_ledger
  ADD COLUMN benefit_grant_id CHAR(36) NULL,
  ADD INDEX idx_usage_benefit_grant (user_id, benefit_grant_id, usage_type, occurred_at);
