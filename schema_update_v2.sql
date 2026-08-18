-- ==============================================================================
-- BẢN CẬP NHẬT CẤU TRÚC SUPABASE (CHỐT CHẶN CUỐI CÙNG)
-- Chạy đoạn mã này trong mục SQL Editor của Supabase để tự động bổ sung mọi 
-- cột dữ liệu có thể bị thiếu trong quá trình đồng bộ từ máy tính lên đám mây.
-- ==============================================================================

-- 1. BẢNG KHÁCH HÀNG (CUSTOMERS)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS zalo_phone text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_source text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tags text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_contact_date date;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS next_care_date date;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS care_cycle_days integer;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_revenue numeric;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_orders integer;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS priority_score numeric;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS overdue_status boolean;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS transferred_status boolean;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_order_date date;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_product_used text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS keyword_category text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_completed_order_date date;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS getfly_url text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS stopped_status boolean;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS estimated_product_end_date date;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS special_note text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS product_expiries jsonb;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS recall_status boolean;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS manual_stopped boolean;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS cancelled_status boolean;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS expiry_formula text;

-- 2. BẢNG SẢN PHẨM (PRODUCTS)
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_name text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_category text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS price numeric;
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_name text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS quantity_per_unit integer;
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_type text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS default_usage_per_day numeric;
ALTER TABLE products ADD COLUMN IF NOT EXISTS inner_unit text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS dosage_per_day text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS usage_cycle_days integer;
ALTER TABLE products ADD COLUMN IF NOT EXISTS reorder_reminder_days integer;
ALTER TABLE products ADD COLUMN IF NOT EXISTS usage_instruction text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE products ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE products ADD COLUMN IF NOT EXISTS active_status boolean;

-- 3. BẢNG ĐƠN HÀNG (ORDERS)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id bigint;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS product_id bigint;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS product_name text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_date date;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS quantity integer;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS unit_price numeric;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount numeric;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_amount numeric;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_status text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_product_end_date date;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_reason text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS items jsonb;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS expiry_formula text;

-- 4. BẢNG LỊCH SỬ CHĂM SÓC (CARE_LOGS)
ALTER TABLE care_logs ADD COLUMN IF NOT EXISTS customer_id bigint;
ALTER TABLE care_logs ADD COLUMN IF NOT EXISTS care_date text;
ALTER TABLE care_logs ADD COLUMN IF NOT EXISTS care_type text;
ALTER TABLE care_logs ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE care_logs ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE care_logs ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE care_logs ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE care_logs ADD COLUMN IF NOT EXISTS is_remedy boolean;

-- 5. BẢNG MẪU TIN NHẮN (MESSAGE_TEMPLATES)
ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS template_name text;
ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS title text;

-- 6. BẢNG LỊCH HẸN (APPOINTMENTS)
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS customer_id bigint;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS appointment_date text;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS transferred_reason text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS transferred_date date;
NOTIFY pgrst, 'reload schema';
