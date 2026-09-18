-- Record the exact event versions included in an analysis. Older analyses remain
-- readable; events without a recorded version are eligible at the next plan slot.
ALTER TABLE ai_analyses
  ADD COLUMN selected_event_versions JSON NULL AFTER selected_event_ids;

-- TIMESTAMP has second precision, so it cannot order rapid exchanges by itself.
ALTER TABLE ai_messages
  ADD COLUMN message_order BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ADD UNIQUE KEY uq_ai_messages_order (message_order),
  ADD INDEX idx_ai_messages_conversation_order (conversation_id, created_at, message_order);
