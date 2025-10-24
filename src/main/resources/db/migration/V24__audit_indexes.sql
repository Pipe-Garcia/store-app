-- === audit_event ===
ALTER TABLE audit_event
  ADD INDEX IF NOT EXISTS idx_audit_event_ts     (timestamp),
  ADD INDEX IF NOT EXISTS idx_audit_event_actor  (actor_name),
  ADD INDEX IF NOT EXISTS idx_audit_event_ent_id (entity, entity_id),
  ADD INDEX IF NOT EXISTS idx_audit_event_status (status);

-- === stock_movement ===
ALTER TABLE stock_movement
  ADD INDEX IF NOT EXISTS idx_sm_ts     (timestamp),
  ADD INDEX IF NOT EXISTS idx_sm_mat_wh (material_id, warehouse_id),
  ADD INDEX IF NOT EXISTS idx_sm_reason (reason),
  ADD INDEX IF NOT EXISTS idx_sm_user   (user_name);

ANALYZE TABLE audit_event, stock_movement;

