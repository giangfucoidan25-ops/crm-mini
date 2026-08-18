ALTER TABLE customers ADD COLUMN IF NOT EXISTS cancelled_status boolean;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE care_logs ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
