INSERT INTO users (username, name, last_name, email, phone, password, role, enabled)
VALUES (
  'admin',
  'Admin',
  'System',
  'admin@example.com',
  '0000000000',
  '$2a$10$PCp4cYjT0CxcQ2eY1oYOn.qMbo3C2n5z2cU0JmWm3mQ7j3g67mXyW', -- admin123
  'ROLE_OWNER',
  b'1'
)
ON DUPLICATE KEY UPDATE
  name      = VALUES(name),
  last_name = VALUES(last_name),
  email     = VALUES(email),
  phone     = VALUES(phone),
  password  = VALUES(password),
  role      = VALUES(role),
  enabled   = VALUES(enabled);
