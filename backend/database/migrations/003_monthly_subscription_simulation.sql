ALTER TABLE user_subscriptions
  ADD COLUMN current_period_start DATETIME NULL AFTER activated_at,
  ADD COLUMN current_period_end DATETIME NULL AFTER current_period_start,
  ADD COLUMN cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE AFTER current_period_end,
  ADD COLUMN canceled_at DATETIME NULL AFTER cancel_at_period_end;

UPDATE user_subscriptions
SET current_period_start = activated_at,
    current_period_end = DATE_ADD(activated_at, INTERVAL 1 MONTH)
WHERE status = 'SIMULATED_ACTIVE'
  AND plan_code IN ('SILVER', 'GOLD')
  AND current_period_end IS NULL;
